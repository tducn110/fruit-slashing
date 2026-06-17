import { createRoot } from "react-dom/client";
import { AuthProvider } from "./app/lib/AuthContext";
import App from "./app/App.tsx";
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
