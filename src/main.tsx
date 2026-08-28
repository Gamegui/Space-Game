import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
// Флаг для NO_MOUNT-страховки в index.html: React смонтировался.
(window as { __appMounted?: boolean }).__appMounted = true;
