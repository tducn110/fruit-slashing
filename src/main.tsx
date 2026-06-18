import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./styles/index.css";

// Remove static preloader once React mounts
const preloader = document.getElementById("preloader");
if (preloader) {
  preloader.classList.add("hide");
  setTimeout(() => preloader.remove(), 400);
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
