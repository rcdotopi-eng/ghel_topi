document.addEventListener("DOMContentLoaded", function () {
  const container = document.querySelector(".box");

  // --- UI Section ---
  const budgetSection = document.createElement("div");
  budgetSection.style.marginTop = "25px";
  budgetSection.innerHTML = `
    <hr style="margin: 20px 0;">
    <h3>📊 Monthly Budget Summary</h3>
    <p>Select a month to generate the school’s combined budget summary.</p>
    <select id="budgetMonth" style="padding: 10px; width: 80%; border-radius: 6px; margin-bottom: 10px;">
      <option value="">Select Month</option>
      ${["01","02","03","04","05","06","07","08","09","10","11","12"]
        .map(m => `<option value="${m}">${new Date(2000, m-1).toLocaleString('default', { month: 'long' })}</option>`)
        .join("")}
    </select>
    <br>
    <button id="generateBudget" class="notice-btn">💰 Generate Monthly Budget</button>
    <div id="status" style="margin-top:10px; color:#333;"></div>
    <div id="downloadOptions" style="display:none; margin-top:15px;">
      <button id="downloadMain" class="notice-btn">⬇️ Download Budget PDF</button>
      <button id="downloadDebug" class="notice-btn">🧾 Download Debug PDF</button>
      <button id="downloadBoth" class="notice-btn">📚 Download Both (Merged)</button>
    </div>
  `;
  container.appendChild(budgetSection);

  // --- Wage Codes ---
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

  // --- PDF.js setup ---
  const pdfjsLib = window["pdfjs-dist/build/pdf"];
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

  document.getElementById("generateBudget").addEventListener("click", async function () {
    const month = document.getElementById("budgetMonth").value;
    const status = document.getElementById("status");
    const downloadOptions = document.getElementById("downloadOptions");

    if (!month) return alert("⚠️ Please select a month.");
    if (typeof payslipFiles === "undefined" || !payslipFiles[month])
      return alert("❌ Payslip file list not found.");

    const monthFiles = payslipFiles[month];
    if (!monthFiles.length) return alert(`❌ No payslips found for ${month}/2025.`);

    status.textContent = `⏳ Reading ${monthFiles.length} payslips...`;
    downloadOptions.style.display = "none";

    const totals = Object.fromEntries(Object.keys(wageMap).map(k => [k, 0]));
    const debugDetails = [];
    let processedCount = 0;

    for (const url of monthFiles) {
      const slipName = url.split("/").pop();
      const slipRows = [];
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        let textContent = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          text.items.forEach(t => (textContent += t.str + " "));
        }

        textContent = textContent.replace(/\s+/g, " ").trim();
        const start = textContent.indexOf("Wage type");
        const end = textContent.indexOf("Deductions");
        const block = start !== -1 && end > start
          ? textContent.slice(start, end)
          : textContent;

        const tokens = block.split(/\s+/);
        let currentCode = null;

        for (let i = 0; i < tokens.length; i++) {
          const token = tokens[i];
          if (/^\d{4}$/.test(token)) {
            currentCode = token;
            continue;
          }
          if (/^\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/.test(token)) {
            const amount = parseFloat(token.replace(/,/g, ""));
            if (currentCode && wageMap[currentCode] && amount > 0) {
              totals[currentCode] += amount;
              slipRows.push({
                code: currentCode,
                description: wageMap[currentCode],
                amount,
              });
            }
            currentCode = null;
          }
        }

        const slipTotal = slipRows.reduce((a, b) => a + b.amount, 0);
        debugDetails.push({ slipName, rows: slipRows, slipTotal });
        processedCount++;
      } catch (err) {
        console.warn(`⚠️ Skipped ${slipName}: ${err.message}`);
      }
    }

    const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);

    // --- Prepare Main Budget PDF ---
    const { jsPDF } = window.jspdf;
    const budgetPDF = new jsPDF("p", "mm", "a4");

    budgetPDF.setFont("times", "bold");
    budgetPDF.setFontSize(14);
    budgetPDF.text("GOVERNMENT OF AZAD JAMMU & KASHMIR", 105, 15, { align: "center" });
    budgetPDF.setFontSize(12);
    budgetPDF.text(
      "SARDAR SHAH MOHAMMAD KHAN LATE GOVT. BOYS HIGH SCHOOL, GHEL TOPI (BAGH)",
      105,
      22,
      { align: "center" }
    );
    budgetPDF.setFontSize(11);
    budgetPDF.text(`Monthly Budget Summary for ${month}/2025`, 105, 30, { align: "center" });
    budgetPDF.setFontSize(9);
    budgetPDF.text(`Processed Payslips: ${processedCount}`, 14, 38);

    const rows = Object.entries(wageMap).map(([code, desc]) => [
      code,
      desc,
      totals[code].toLocaleString("en-PK", { minimumFractionDigits: 2 }),
    ]);
    rows.push(["", "Total", totalSum.toLocaleString("en-PK", { minimumFractionDigits: 2 })]);

    budgetPDF.autoTable({
      startY: 42,
      head: [["Wage Type", "Description", "Total (Rs)"]],
      body: rows,
      theme: "grid",
      styles: { font: "times", fontSize: 10, halign: "center" },
      headStyles: { fillColor: [0, 74, 173], textColor: 255, fontStyle: "bold" },
      columnStyles: { 1: { halign: "left" }, 2: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });

    let finalY = budgetPDF.lastAutoTable.finalY + 20;
    budgetPDF.setFont("times", "italic");
    budgetPDF.setFontSize(11);
    budgetPDF.text("_________________________", 25, finalY);
    budgetPDF.text("_________________________", 135, finalY);
    budgetPDF.text("Accountant", 35, finalY + 6);
    budgetPDF.text("Headmaster", 150, finalY + 6);

    // --- Prepare Debug PDF ---
    const debugPDF = new jsPDF("p", "mm", "a4");
    debugPDF.setFont("times", "bold");
    debugPDF.setFontSize(13);
    debugPDF.text(`DEBUG REPORT - Monthly Budget Details (${month}/2025)`, 105, 15, { align: "center" });
    debugPDF.setFontSize(10);
    let y = 25;

    for (const slip of debugDetails) {
      debugPDF.setFont("times", "bold");
      debugPDF.text(`Payslip: ${slip.slipName}`, 14, y);
      y += 5;

      const slipRows = slip.rows.map(r => [
        r.code,
        r.description,
        r.amount.toLocaleString("en-PK", { minimumFractionDigits: 2 }),
      ]);

      debugPDF.autoTable({
        startY: y,
        head: [["Code", "Description", "Amount (Rs)"]],
        body: slipRows,
        theme: "grid",
        styles: { font: "times", fontSize: 9 },
        columnStyles: { 1: { halign: "left" }, 2: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });

      y = debugPDF.lastAutoTable.finalY + 5;
      debugPDF.text(`Subtotal: Rs ${slip.slipTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 150, y, { align: "right" });
      y += 10;

      if (y > 260) {
        debugPDF.addPage();
        y = 20;
      }
    }

    debugPDF.setFont("times", "bold");
    debugPDF.setFontSize(11);
    debugPDF.text(`Grand Total: Rs ${totalSum.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`, 150, y, { align: "right" });

    // --- Store PDFs for later download ---
    window.generatedBudgetPDF = budgetPDF;
    window.generatedDebugPDF = debugPDF;
    window.generatedMonth = month;

    status.textContent = `✅ Reports generated successfully! Choose what to download below.`;
    downloadOptions.style.display = "block";
  });

  // --- Helper to merge PDFs ---
  async function mergePDFs(doc1, doc2) {
    const merged = new jsPDF("p", "mm", "a4");
    const pdfs = [doc1, doc2];

    for (const doc of pdfs) {
      const pages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        if (i > 1 || doc !== pdfs[0]) merged.addPage();
        const pageData = doc.getPageContent ? doc.getPageContent(i) : doc.output("datauristring");
        const imgData = doc.getPageAsImage ? await doc.getPageAsImage(i) : null;
      }
    }
    return merged;
  }

  // --- Download buttons ---
  document.getElementById("downloadMain").addEventListener("click", function () {
    if (window.generatedBudgetPDF) window.generatedBudgetPDF.save(`Monthly_Budget_${window.generatedMonth}_2025.pdf`);
  });

  document.getElementById("downloadDebug").addEventListener("click", function () {
    if (window.generatedDebugPDF) window.generatedDebugPDF.save(`Monthly_Budget_Debug_${window.generatedMonth}_2025.pdf`);
  });

  document.getElementById("downloadBoth").addEventListener("click", async function () {
    const { jsPDF } = window.jspdf;
    if (!window.generatedBudgetPDF || !window.generatedDebugPDF) return alert("Generate reports first.");

    const merged = new jsPDF();
    const addPDF = async (srcDoc) => {
      const pages = srcDoc.internal.getNumberOfPages();
      for (let i = 1; i <= pages; i++) {
        if (i > 1 || merged.internal.getNumberOfPages() > 0) merged.addPage();
        const pageData = srcDoc.output("datauristring");
        merged.addImage(pageData, "JPEG", 0, 0, 210, 297);
      }
    };

    await addPDF(window.generatedBudgetPDF);
    await addPDF(window.generatedDebugPDF);

    merged.save(`Monthly_Budget_Combined_${window.generatedMonth}_2025.pdf`);
  });
});
