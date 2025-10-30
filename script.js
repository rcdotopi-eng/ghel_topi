// Fetch and display notices
fetch('notices.json')
  .then(response => response.json())
  .then(data => {
    const box = document.getElementById('notices-box');
    box.innerHTML = '';
    if (data.notices.length === 0) {
      box.innerHTML = '<p>No current notices.</p>';
    } else {
      data.notices.forEach(notice => {
        const p = document.createElement('p');
        p.textContent = notice;
        box.appendChild(p);
      });
    }
  })
  .catch(() => {
    document.getElementById('notices-box').innerHTML = '<p>⚠️ Unable to load notices.</p>';
  });

// Payslip function
function openPayslip() {
  const num = document.getElementById('pnum').value.trim();
  const msg = document.getElementById('msg');
  msg.innerText = "";
  if (!num) {
    msg.innerText = "⚠️ Please enter your personal number.";
    return;
  }
  const url = 'payslips/' + num + '.pdf';
  fetch(url)
    .then(r => {
      if (r.ok) window.open(url, '_blank');
      else msg.innerText = "❌ Payslip not found. Please check your number.";
    })
    .catch(() => {
      msg.innerText = "⚠️ Error opening payslip. Please try again.";
    });
}
