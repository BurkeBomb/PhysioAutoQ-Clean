import React, { useState } from "react";
import PhysiotherapyQuoteBuilder from "./components/PhysiotherapyQuoteBuilder.jsx";
import AnaestheticQuoteForm from "./components/AnaestheticQuoteForm.jsx";

const App = () => {
  const [activeTool, setActiveTool] = useState("physio"); // "physio" | "anaes"

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "1.5rem",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
          background: "white",
          borderRadius: "1rem",
          boxShadow: "0 10px 30px rgba(15,23,42,0.12)",
          padding: "1rem 1rem 1.5rem",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "0.02em",
              }}
            >
              MediBurgh AutoQuote
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#6b7280", marginTop: "0.15rem" }}>
              Quick quote builder for Physiotherapy & Anaesthetists.
            </p>
          </div>

          <div
            style={{
              display: "inline-flex",
              borderRadius: "999px",
              border: "1px solid #e5e7eb",
              padding: "0.2rem",
              background: "#f9fafb",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTool("physio")}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
                background:
                  activeTool === "physio" ? "#111827" : "transparent",
                color: activeTool === "physio" ? "#f9fafb" : "#4b5563",
                transition: "all 0.15s ease",
              }}
            >
              Physio Quote
            </button>
            <button
              type="button"
              onClick={() => setActiveTool("anaes")}
              style={{
                padding: "0.4rem 0.9rem",
                borderRadius: "999px",
                border: "none",
                cursor: "pointer",
                fontSize: "0.9rem",
                fontWeight: 500,
                background:
                  activeTool === "anaes" ? "#111827" : "transparent",
                color: activeTool === "anaes" ? "#f9fafb" : "#4b5563",
                transition: "all 0.15s ease",
              }}
            >
              Anaesthetist Quote
            </button>
          </div>
        </header>

        <main>
          {activeTool === "physio" ? (
            <PhysiotherapyQuoteBuilder />
          ) : (
            <AnaestheticQuoteForm />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
