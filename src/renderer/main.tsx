import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { PRODUCT_NAME } from "../shared/product";
import { App } from "./App";
import "./styles/tokens.css";
import "./styles/app.css";

const root = document.getElementById("root");

if (!root) throw new Error("Renderer root element was not found");

document.title = PRODUCT_NAME;

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
