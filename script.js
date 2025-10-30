// Fetch and display notices
fetch('notices.json')
  .then(response => response.json())
  .then(data => {
    const list = document.getElementById('notices-list');
    list.innerHTML = '';
    data.notices.forEach(notice => {
      const li = document.createElement('li');
      li.textContent = notice;
      list.appendChild(li);
    });
  })
  .catch(() => {
    document.getElementById('notices-list').innerHTML = '<li>⚠️ Unable to load notices.</li>';
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
      if (r.ok) {
        window.open(url, '_blank');
      } else {
        msg.innerText = "❌ Payslip not found. Please check your number.";
      }
    })
    .catch(() => {
      msg.innerText = "⚠️ Error opening payslip. Please try again.";
    });
}
