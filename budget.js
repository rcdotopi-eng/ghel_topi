document.addEventListener("DOMContentLoaded", function () {
  const container = document.querySelector(".box");

  // --- Add Budget Section ---
  const budgetSection = document.createElement("div");
  budgetSection.style.marginTop = "25px";
  budgetSection.innerHTML = `
    <hr style="margin: 20px 0;">
    <h3>📊 Monthly Budget Summary</h3>
    <p>Select a month to generate the school’s combined budget summary (official format).</p>
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
    <div id="status" style="margin-top:10px; color:#333;"></div>
  `;
  container.appendChild(budgetSection);

  // --- Wage Map ---
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

  // --- Generate Budget PDF ---
  document.getElementById("generateBudget").addEventListener("click", async function () {
    const month = document.getElementById("budgetMonth").value;
    const status = document.getElementById("status");

    if (!month) {
      alert("⚠️ Please select a month first.");
      return;
    }

    const monthFiles = payslipFiles[month];
    if (!monthFiles || monthFiles.length === 0) {
      alert(`❌ No payslip files defined for month ${month}.`);
      return;
    }

    status.textContent = `⏳ Processing ${monthFiles.length} payslips... please wait.`;

    const totals = {};
    for (const code in wageMap) totals[code] = 0;

    let processedCount = 0;
    let skippedCount = 0;

    for (const url of monthFiles) {
      try {
        const pdf = await pdfjsLib.getDocument(url).promise;
        let textContent = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          text.items.forEach((t) => (textContent += t.str + " "));
        }

        const regex = /(\d{4})\s+[A-Za-z().%/ ]+?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/g;
        let match;
        while ((match = regex.exec(textContent)) !== null) {
          const code = match[1];
          const amount = parseFloat(match[2].replace(/,/g, ""));
          if (wageMap[code]) totals[code] += amount;
        }

        processedCount++;
      } catch (err) {
        skippedCount++;
        console.warn(`⚠️ Skipped ${url}: ${err.message}`);
      }
    }

    // --- Create PDF ---
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // --- Header ---
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.text("GOVERNMENT OF AZAD JAMMU & KASHMIR", 105, 15, { align: "center" });
    doc.setFontSize(12);
    doc.text("SARDAR SHAH MOHAMMAD KHAN LATE GOVT. BOYS HIGH SCHOOL, GHEL TOPI (BAGH)", 105, 22, { align: "center" });
    doc.setFontSize(11);
    doc.text(`Monthly Budget Summary for ${month}/2025`, 105, 30, { align: "center" });

    // --- Process Info ---
    doc.setFontSize(9);
    doc.text(`Processed Payslips: ${processedCount} | Skipped: ${skippedCount}`, 14, 38);

    // --- Table Data ---
    const rows = Object.entries(wageMap).map(([code, desc]) => [
      code,
      desc,
      totals[code] ? totals[code].toLocaleString("en-PK", { minimumFractionDigits: 2 }) : "0.00",
    ]);

    const totalSum = Object.values(totals).reduce((a, b) => a + b, 0);
    rows.push(["", "Total", totalSum.toLocaleString("en-PK", { minimumFractionDigits: 2 })]);

    // --- Table ---
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

    // --- Footer: Signatures ---
    let finalY = doc.lastAutoTable.finalY + 20;
    doc.setFont('times', 'italic');
    doc.setFontSize(11);
    doc.text("_________________________", 25, finalY);
    doc.text("_________________________", 135, finalY);
    doc.text("Clerk", 35, finalY + 6);
    doc.text("Headmaster", 150, finalY + 6);

    // --- Save PDF ---
    doc.save(`Monthly_Budget_${month}_2025.pdf`);
    status.textContent = `✅ Budget generated successfully! (${processedCount} processed, ${skippedCount} skipped)`;
  });
});
