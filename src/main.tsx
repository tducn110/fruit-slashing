import { createRoot } from "react-dom/client";
import App from "./App";
import { bootstrapGoogleH5Ads } from "./integrations/ads/googleH5Ads";
import "./styles/index.css";

void bootstrapGoogleH5Ads();
createRoot(document.getElementById("root")!).render(<App />);
