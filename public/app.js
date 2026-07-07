async function sendReport() {
  const photo = document.getElementById("photo").files[0];
  const building = document.getElementById("building").value;
  const location = document.getElementById("location").value;
  const content = document.getElementById("content").value;

  const formData = new FormData();
  formData.append("photo", photo);
  formData.append("building", building);
  formData.append("location", location);
  formData.append("content", content);

  const res = await fetch("/report", {
    method: "POST",
    body: formData
  });

  const data = await res.json();

  if (data.ok) {
    alert("신고 완료!");
  } else {
    alert("실패");
  }
}