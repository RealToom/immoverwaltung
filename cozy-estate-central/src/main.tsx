import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { ThemeProvider } from "./components/theme-provider.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider attribute="class" defaultTheme="system" storageKey="vite-ui-theme" enableSystem>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </ThemeProvider>
);
