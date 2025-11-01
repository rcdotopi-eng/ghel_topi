document.addEventListener("DOMContentLoaded", function () {
  const container = document.querySelector(".box");

  // --- Budget Section ---
  const budgetSection = document.createElement("div");
  budgetSection.style.marginTop = "20px";
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
    <div id="status" style="margin-top:10px; color:#333;"></div>
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

  // Load PDF.js
  const pdfjsLib = window["pdfjs-dist/build/pdf"];
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

  // --- Main process ---
  document.getElementById("generateBudget").addEventListener("click", async function () {
    const month = document.getElementById("budgetMonth").value;
    const status = document.getElementById("status");

    if (!month) {
      alert("Please select a month!");
      return;
    }

    const monthFiles = payslipFiles[month];
    if (!monthFiles || monthFiles.length === 0) {
      alert(`No payslip files found for month ${month}.`);
      return;
    }

    status.textContent = `Processing ${monthFiles.length} payslips... please wait.`;

    const totals = {};
    for (const code in wageMap) totals[code] = 0;

    // --- Loop through all payslip URLs ---
    for (const url of monthFiles) {
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
    }

    // --- Generate final PDF ---
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const data = Object.entries(wageMap).map(([code, desc]) => [
      code,
      desc,
      totals[code] ? totals[code].toLocaleString("en-PK", { minimumFractionDigits: 2 }) : "0.00",
    ]);

    const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);

    const tableData = [
      ...data,
      ["", "Total", grandTotal.toLocaleString("en-PK", { minimumFractionDigits: 2 })],
    ];

    doc.setFontSize(14);
    doc.text("Sardar Shah Mohammad Khan Late Govt. Boys High School Ghel Topi, Bagh", 14, 15);
    doc.setFontSize(12);
    doc.text(`Monthly Budget Summary — Month ${month} (Combined Payslips)`, 14, 25);

    doc.autoTable({
      startY: 35,
      head: [["Wage Type", "Description", "Total (Rs)"]],
      body: tableData,
      theme: "grid",
      headStyles: { fillColor: [0, 74, 173] },
      styles: { halign: "center", valign: "middle" },
    });

    doc.save(`Monthly_Budget_${month}_2025.pdf`);
    status.textContent = "✅ Budget PDF generated successfully!";
  });
});
