document.addEventListener("DOMContentLoaded", function () {
  const container = document.querySelector(".box");

  // --- Budget section ---
  const budgetSection = document.createElement("div");
  budgetSection.style.marginTop = "25px";
  budgetSection.innerHTML = `
    <hr style="margin: 20px 0;">
    <h3>📊 Monthly Budget Summary</h3>
    <p>Select a month to generate the school’s combined budget summary.</p>
    <select id="budgetMonth" style="padding: 10px; width: 80%; border-radius: 6px; margin-bottom: 10px;">
      <option value="">Select Month</option>
      <option value="01">January</option>
      <option value="02">February</option>
      <option value="03">March</option>
      <option value="04">April</option>
      <option value="05">May</option>
      <option value="06">June</option>
      <option value="07">July</option>
      <option value="08">August</option>
      <option value="09">September</option>
      <option value="10">October</option>
      <option value="11">November</option>
      <option value="12">December</option>
    </select>
    <br>
    <button id="generateBudget" class="notice-btn">💰 Generate Monthly Budget PDF</button>
    <button id="downloadDebug" class="notice-btn" style="margin-left:8px; display:none;">📥 Download Debug JSON</button>
    <div id="status" style="margin-top:10px; color:#333;"></div>
  `;
  container.appendChild(budgetSection);

  // --- Allowed wage codes ---
  const wageMap = {
    "0001": "Basic Pay",
    "1000": "House Rent Allowance",
    "1210": "Convey Allowance",
    "1300": "Medical Allowance",
    "1505": "Charge Allowance",
    "1516": "Dress/Uniform Allowance",
    "1530": "Hill Allowance",
    "1546": "Qualification Allowance",
    "1567": "Washing Allowance",
    "1838": "Teaching Allowance (2005)",
    "1947": "Medical Allow 15% (16-22)",
    "2318": "Disparity Reduction Allowance 25%",
    "2347": "Adhoc Relief Allowance 15% (22 PS17)",
    "2355": "Disparity Reduction Allowance 15%",
    "2378": "Adhoc Relief Allowance 2023 (35%)",
    "2379": "Adhoc Relief Allowance 2023 (30%)",
    "2393": "Adhoc Relief Allowance 2024 (25%)",
    "2394": "Adhoc Relief Allowance 2024 (20%)",
    "2419": "Adhoc Relief 2025 (10%)",
    "2420": "Disparity Reduction Allowance 30% (2025)"
  };

  // --- Load PDF.js ---
  const pdfjsLib = window["pdfjs-dist/build/pdf"];
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

  // debug download button
  const downloadDebugBtn = document.getElementById("downloadDebug");

  document.getElementById("generateBudget").addEventListener("click", async function () {
    const month = document.getElementById("budgetMonth").value;
    const status = document.getElementById("status");
    downloadDebugBtn.style.display = "none";
    if (!month) return alert("⚠️ Please select a month.");
    if (typeof payslipFiles === "undefined" || !payslipFiles[month])
      return alert("❌ Payslip file list not found.");

    const monthFiles = payslipFiles[month];
    if (!monthFiles.length) return alert(`❌ No payslips found for ${month}/2025.`);

    status.textContent = `⏳ Reading ${monthFiles.length} payslips...`;

    // Initialize totals and debug collectors
    const totals = {};
    for (const code in wageMap) totals[code] = 0;

    const debug = {
      month,
      files: [],
      globalMatches: [], // { file, code, description, amount, snippet }
      totalsBefore: {}
    };

    let processedCount = 0;

    // regex with lookahead to stop before next code/Deductions/end
    const regex = /(\d{4})\s+([A-Za-z()/%\-\d\s]+?)\s+(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?=\s+\d{4}|\s+Deductions|$)/g;

    for (const url of monthFiles) {
      const fileDebug = { url, matches: [] };
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        let textContent = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          text.items.forEach(t => (textContent += t.str + " "));
        }
        textContent = textContent.replace(/\s+/g, " ").trim();

        // optional: try to extract the "Pay and Allowances" block only to limit false matches
        // Look for "Pay and Allowances" then upto "Deductions"
        let payBlock = textContent;
        const paIndex = textContent.search(/Pay and Allowances/i);
        if (paIndex !== -1) {
          // cut from Pay and Allowances until Deductions (if present)
          const dedIndex = textContent.search(/Deductions\s*-\s*General/i);
          if (dedIndex !== -1 && dedIndex > paIndex) {
            payBlock = textContent.substring(paIndex, dedIndex);
          } else {
            payBlock = textContent.substring(paIndex);
          }
        }

        // run regex on payBlock
        let m;
        while ((m = regex.exec(payBlock)) !== null) {
          const code = m[1];
          const description = m[2].trim().replace(/\s+/g, ' ');
          const amountStr = m[3].replace(/,/g, "");
          const amount = parseFloat(amountStr);
          // snippet
          const span = m.index;
          const snippet = payBlock.substring(Math.max(0, span - 60), Math.min(payBlock.length, m.index + m[0].length + 60));
          // record
          fileDebug.matches.push({ code, description, amount, snippet });
          debug.globalMatches.push({ file: url, code, description, amount, snippet });

          // sum only allowed codes and positive amounts > 0.00
          if (wageMap[code] && !isNaN(amount) && amount > 0) {
            totals[code] = (totals[code] || 0) + amount;
          }
        }

        debug.files.push(fileDebug);
        processedCount++;
      } catch (err) {
        console.warn(`⚠️ Skipped ${url}: ${err.message}`);
        debug.files.push({ url, error: err.message, matches: [] });
      }
    }

    // Put totals snapshot in debug
    debug.totalsAfter = JSON.parse(JSON.stringify(totals));

    // console debug output (open developer console)
    console.group("Payslip extraction debug");
    console.log("Processed files:", processedCount);
    console.table(totals);
    console.log("Sample matches (first 40):", debug.globalMatches.slice(0, 40));
    console.groupEnd();

    // prepare debug JSON for download
    const debugBlob = new Blob([JSON.stringify(debug, null, 2)], { type: "application/json" });
    downloadDebugBtn.onclick = () => {
      const url = URL.createObjectURL(debugBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `debug_payslips_${month}_2025.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
    downloadDebugBtn.style.display = "inline-block";

    // --- Generate summary PDF ---
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF("p", "mm", "a4");

    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.text("GOVERNMENT OF AZAD JAMMU & KASHMIR", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text(
      "SARDAR SHAH MOHAMMAD KHAN LATE GOVT. BOYS HIGH SCHOOL, GHEL TOPI (BAGH)",
      105,
      22,
      { align: "center" }
    );
    doc.setFontSize(11);
    doc.text(`Monthly Budget Summary for ${month}/2025`, 105, 30, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Processed Payslips: ${processedCount}`, 14, 38);

    const rows = Object.entries(wageMap).map(([code, desc]) => [
      code,
      desc,
      (totals[code] || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 }),
    ]);

    const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
    rows.push(["", "Total", totalSum.toLocaleString("en-PK", { minimumFractionDigits: 2 })]);

    doc.autoTable({
      startY: 42,
      head: [["Wage Type", "Description", "Total (Rs)"]],
      body: rows,
      theme: "grid",
      styles: { font: "times", fontSize: 10, halign: "center", valign: "middle" },
      headStyles: { fillColor: [0, 74, 173], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 110, halign: "left" },
        2: { cellWidth: 40, halign: "right" }
      },
      margin: { left: 14, right: 14 },
    });

    let finalY = doc.lastAutoTable.finalY + 20;
    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.text("_________________________", 25, finalY);
    doc.text("_________________________", 135, finalY);
    doc.text("Accountant", 35, finalY + 6);
    doc.text("Headmaster", 150, finalY + 6);

    doc.save(`Monthly_Budget_${month}_2025.pdf`);
    status.textContent = `✅ Monthly budget generated successfully! (${processedCount} payslips processed). Debug JSON ready.`;
  });
});
