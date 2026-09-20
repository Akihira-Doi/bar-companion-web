const parameters = new URLSearchParams(window.location.search);
const errorMessage = document.querySelector("#login-error");

if (parameters.get("error") === "invalid") {
  errorMessage.hidden = false;
}
