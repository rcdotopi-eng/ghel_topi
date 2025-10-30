// script.js

fetch("notices.json")
  .then(response => response.json())
  .then(data => {
    const ul = document.getElementById("noticeList");
    ul.innerHTML = ""; // clear 'loading' text
    data.notices.forEach(notice => {
      const li = document.createElement("li");
      li.textContent = notice;
      ul.appendChild(li);
    });
  })
  .catch(error => {
    console.error("Error loading notices:", error);
    document.getElementById("noticeList").innerHTML =
      "<li>⚠️ Unable to load notices.</li>";
  });
