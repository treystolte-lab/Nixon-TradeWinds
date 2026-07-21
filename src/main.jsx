import "./storage-shim.js";
import React from "react";
import { createRoot } from "react-dom/client";
import Tradewinds from "./Tradewinds.jsx";

createRoot(document.getElementById("root")).render(<Tradewinds />);
