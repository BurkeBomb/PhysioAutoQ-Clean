import React from 'react';
import PhysiotherapyQuoteBuilder from './components/PhysiotherapyQuoteBuilder.jsx';

const App = () => {
  return <PhysiotherapyQuoteBuilder />;
};
import { useState, useMemo } from "react";

function formatCurrency(value) {
  if (isNaN(value) || value === null) return "R 0.00";
  return (
    "R " +
    value
      .toFixed(2)
      .replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  );
}

export default function AnaestheticQuoteForm() {
  // Practice details – you can change the defaults to your real practice
  const [practice, setPractice] = useState({
    name: "Dr A. Example – Anaesthesiology",
    practiceNumber: "0123456",
    hpcsaNumber: "MP1234567",
    telephone: "011 123 4567",
    email: "quotes@example-anaes.co.za",
    address: "Suite 101, Example Medical Centre, Johannesburg",
    billingContactName: "Claire",
    billingContactPhone: "082 123 4567",
    bankName: "FNB",
    bankAccountName: "Dr A Example Inc",
    bankAccountNumber: "123456789",
    bankBranchCode: "250655",
  });

  const [patient, setPatient] = useState({
    fullName: "",
    idNumber: "",
    scheme: "",
    schemeOption: "",
    memberNumber: "",
    dependantCode: "",
    contactNumber: "",
    email: "",
  });

  const [procedure, setProcedure] = useState({
    hospital: "",
    dateOfSurgery: "",
    surgeonName: "",
    description: "",
    asaStatus: "",
    theatreInTime: "",
    theatreOutTime: "",
    weightKg: "",
    heightM: "",
  });

  const [extras, setExtras] = useState({
    callOutFee: "",
    travelFee: "",
    otherDesc: "",
    otherAmount: "",
    discountPercentage: "0",
    includeVat: true,
    vatRatePercentage: "15",
    validityDays: "14",
    referenceNumber: "",
    notesForAnaesthetist: "",
    notesForPatient:
      "This quote is based on the planned procedure and estimated anaesthetic time.",
  });

  const [codes, setCodes] = useState([
    { id: 1, code: "", description: "", units: "", ratePerUnit: "" },
  ]);

  // Auto BMI
  const bmi = useMemo(() => {
    const w = parseFloat(procedure.weightKg);
    const h = parseFloat(procedure.heightM);
    if (!w || !h || h === 0) return "";
    return (w / (h * h)).toFixed(1);
  }, [procedure.weightKg, procedure.heightM]);

  const handlePracticeChange = (field, value) => {
    setPractice((prev) => ({ ...prev, [field]: value }));
  };

  const handlePatientChange = (field, value) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
  };

  const handleProcedureChange = (field, value) => {
    setProcedure((prev) => ({ ...prev, [field]: value }));
  };

  const handleExtrasChange = (field, value) => {
    setExtras((prev) => ({ ...prev, [field]: value }));
  };

  const handleCodeChange = (id, field, value) => {
    setCodes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const addCodeRow = () => {
    setCodes((prev) => [
      ...prev,
      {
        id: prev.length === 0 ? 1 : prev[prev.length - 1].id + 1,
        code: "",
        description: "",
        units: "",
        ratePerUnit: "",
      },
    ]);
  };

  const removeCodeRow = (id) => {
    setCodes((prev) => prev.filter((c) => c.id !== id));
  };

  // Calculations
  const {
    lineSubtotal,
    callOutFeeNum,
    travelFeeNum,
    otherAmountNum,
    subtotalBeforeDiscount,
    discountPercentageNum,
    discountAmount,
    subtotalAfterDiscount,
    vatRateNum,
    vatAmount,
    grandTotal,
  } = useMemo(() => {
    const lineSubtotalLocal = codes.reduce((sum, c) => {
      const units = parseFloat(c.units) || 0;
      const rate = parseFloat(c.ratePerUnit) || 0;
      return sum + units * rate;
    }, 0);

    const callOut = parseFloat(extras.callOutFee) || 0;
    const travel = parseFloat(extras.travelFee) || 0;
    const other = parseFloat(extras.otherAmount) || 0;

    const subtotalBefore = lineSubtotalLocal + callOut + travel + other;

    const discPerc = parseFloat(extras.discountPercentage) || 0;
    const discountAmt = subtotalBefore * (discPerc / 100);

    const subtotalAfter = subtotalBefore - discountAmt;

    const vatPerc = extras.includeVat
      ? parseFloat(extras.vatRatePercentage) || 0
      : 0;

    const vatAmt = subtotalAfter * (vatPerc / 100);
    const grand = subtotalAfter + vatAmt;

    return {
      lineSubtotal: lineSubtotalLocal,
      callOutFeeNum: callOut,
      travelFeeNum: travel,
      otherAmountNum: other,
      subtotalBeforeDiscount: subtotalBefore,
      discountPercentageNum: discPerc,
      discountAmount: discountAmt,
      subtotalAfterDiscount: subtotalAfter,
      vatRateNum: vatPerc,
      vatAmount: vatAmt,
      grandTotal: grand,
    };
  }, [codes, extras]);

  // Build plain-text quote (for email / copy-paste)
  const quoteText = useMemo(() => {
    const missingBits = [];
    if (!patient.fullName) missingBits.push("patient name");
    if (!procedure.description) missingBits.push("procedure description");
    if (codes.every((c) => !c.code && !c.description)) {
      missingBits.push("fee codes");
    }

    const note =
      missingBits.length > 0
        ? `[Note: Missing ${missingBits.join(
            ", "
          )}. Quote based on available information only.]\n\n`
        : "";

    const linesSection =
      codes.length === 0
        ? "No fee lines captured.\n"
        : codes
            .map((c) => {
              const units = parseFloat(c.units) || 0;
              const rate = parseFloat(c.ratePerUnit) || 0;
              const total = units * rate;
              if (!c.code && !c.description && total === 0) return "";
              return (
                `Code: ${c.code || "-"}\n` +
                `Description: ${c.description || "-"}\n` +
                `Units: ${units} @ ${formatCurrency(rate)} per unit\n` +
                `Line total: ${formatCurrency(total)}\n`
              );
            })
            .filter(Boolean)
            .join("\n");

    const extrasLines = [
      callOutFeeNum > 0
        ? `Call-out fee: ${formatCurrency(callOutFeeNum)}`
        : null,
      travelFeeNum > 0
        ? `Travel fee: ${formatCurrency(travelFeeNum)}`
        : null,
      otherAmountNum > 0
        ? `${extras.otherDesc || "Other fee"}: ${formatCurrency(
            otherAmountNum
          )}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const disclaimer =
      "Disclaimer:\n" +
      "- This is an estimate only, based on the information provided.\n" +
      "- Final anaesthetic fees may differ depending on actual theatre time, patient condition, and medical aid rules.\n" +
      "- Your benefit remains subject to your scheme rules and available benefits.\n" +
      "- Any shortfall not covered by your scheme will remain your responsibility.\n";

    return (
      note +
      `${practice.name}\n` +
      `Practice No: ${practice.practiceNumber} | HPCSA: ${practice.hpcsaNumber}\n` +
      `${practice.address}\n` +
      `Tel: ${practice.telephone} | Email: ${practice.email}\n\n` +
      `ANAESTHETIC QUOTATION\n` +
      (extras.referenceNumber
        ? `Reference: ${extras.referenceNumber}\n\n`
        : "\n") +
      `Patient Details:\n` +
      `- Name: ${patient.fullName || "-"}\n` +
      `- ID Number: ${patient.idNumber || "-"}\n` +
      `- Medical Scheme: ${patient.scheme || "-"}\n` +
      `- Scheme Option: ${patient.schemeOption || "-"}\n` +
      `- Membership / Dependant: ${patient.memberNumber || "-"} / ${
        patient.dependantCode || "-"
      }\n` +
      `- Contact: ${patient.contactNumber || "-"} | ${
        patient.email || "-"
      }\n\n` +
      `Procedure & Anaesthetic Summary:\n` +
      `- Hospital: ${procedure.hospital || "-"}\n` +
      `- Date of Surgery: ${procedure.dateOfSurgery || "-"}\n` +
      `- Surgeon: ${procedure.surgeonName || "-"}\n` +
      `- Procedure: ${procedure.description || "-"}\n` +
      `- ASA Status: ${procedure.asaStatus || "-"}\n` +
      `- Theatre Time: ${
        procedure.theatreInTime || "-"
      } to ${procedure.theatreOutTime || "-"}\n` +
      `- Weight / Height / BMI: ${
        procedure.weightKg || "-"
      } kg / ${procedure.heightM || "-"} m / ${
        bmi || "-"
      }\n\n` +
      `Estimated Anaesthetic Fees:\n\n` +
      linesSection +
      (extrasLines ? `\nExtras:\n${extrasLines}\n\n` : "\n") +
      `Totals:\n` +
      `- Subtotal before discount: ${formatCurrency(
        subtotalBeforeDiscount
      )}\n` +
      `- Discount (${discountPercentageNum}%): -${formatCurrency(
        discountAmount
      )}\n` +
      `- Subtotal after discount: ${formatCurrency(subtotalAfterDiscount)}\n` +
      `- VAT (${vatRateNum}%): ${formatCurrency(vatAmount)}\n` +
      `- GRAND TOTAL (estimate): ${formatCurrency(grandTotal)}\n\n` +
      `Banking Details:\n` +
      `- Bank: ${practice.bankName}\n` +
      `- Account Name: ${practice.bankAccountName}\n` +
      `- Account Number: ${practice.bankAccountNumber}\n` +
      `- Branch Code: ${practice.bankBranchCode}\n\n` +
      (extras.validityDays
        ? `This quotation is valid for ${extras.validityDays} days.\n\n`
        : "") +
      `Notes to Patient:\n${extras.notesForPatient || "-"}\n\n` +
      disclaimer
    );
  }, [
    practice,
    patient,
    procedure,
    extras,
    codes,
    bmi,
    callOutFeeNum,
    travelFeeNum,
    otherAmountNum,
    subtotalBeforeDiscount,
    discountPercentageNum,
    discountAmount,
    subtotalAfterDiscount,
    vatRateNum,
    vatAmount,
    grandTotal,
  ]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(quoteText);
      alert("Quote copied to clipboard.");
    } catch (e) {
      alert("Could not copy. Please select and copy manually.");
    }
  };

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        padding: "1.5rem",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.75rem" }}>
        Anaesthetic Quote Builder
      </h1>
      <p style={{ marginBottom: "1.5rem", fontSize: "0.95rem", color: "#4b5563" }}>
        Capture anaesthetist case details, codes, and extras. The tool calculates a
        full quotation in South African Rand and generates an email-ready text
        block you can copy or save.
      </p>

      {/* Practice details */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Practice Details
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div>
            <label>Practice Name</label>
            <input
              type="text"
              value={practice.name}
              onChange={(e) => handlePracticeChange("name", e.target.value)}
            />
          </div>
          <div>
            <label>Practice Number</label>
            <input
              type="text"
              value={practice.practiceNumber}
              onChange={(e) =>
                handlePracticeChange("practiceNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>HPCSA Number</label>
            <input
              type="text"
              value={practice.hpcsaNumber}
              onChange={(e) =>
                handlePracticeChange("hpcsaNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>Telephone</label>
            <input
              type="text"
              value={practice.telephone}
              onChange={(e) =>
                handlePracticeChange("telephone", e.target.value)
              }
            />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={practice.email}
              onChange={(e) => handlePracticeChange("email", e.target.value)}
            />
          </div>
          <div>
            <label>Billing Contact Name</label>
            <input
              type="text"
              value={practice.billingContactName}
              onChange={(e) =>
                handlePracticeChange("billingContactName", e.target.value)
              }
            />
          </div>
          <div>
            <label>Billing Contact Phone</label>
            <input
              type="text"
              value={practice.billingContactPhone}
              onChange={(e) =>
                handlePracticeChange("billingContactPhone", e.target.value)
              }
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Address</label>
            <input
              type="text"
              value={practice.address}
              onChange={(e) =>
                handlePracticeChange("address", e.target.value)
              }
            />
          </div>
        </div>

        <h3
          style={{
            fontSize: "0.95rem",
            fontWeight: 600,
            marginTop: "1rem",
            marginBottom: "0.5rem",
          }}
        >
          Banking Details
        </h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div>
            <label>Bank Name</label>
            <input
              type="text"
              value={practice.bankName}
              onChange={(e) =>
                handlePracticeChange("bankName", e.target.value)
              }
            />
          </div>
          <div>
            <label>Account Name</label>
            <input
              type="text"
              value={practice.bankAccountName}
              onChange={(e) =>
                handlePracticeChange("bankAccountName", e.target.value)
              }
            />
          </div>
          <div>
            <label>Account Number</label>
            <input
              type="text"
              value={practice.bankAccountNumber}
              onChange={(e) =>
                handlePracticeChange("bankAccountNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>Branch Code</label>
            <input
              type="text"
              value={practice.bankBranchCode}
              onChange={(e) =>
                handlePracticeChange("bankBranchCode", e.target.value)
              }
            />
          </div>
        </div>
      </section>

      {/* Patient details */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Patient Details
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div>
            <label>Full Name</label>
            <input
              type="text"
              value={patient.fullName}
              onChange={(e) =>
                handlePatientChange("fullName", e.target.value)
              }
            />
          </div>
          <div>
            <label>ID Number</label>
            <input
              type="text"
              value={patient.idNumber}
              onChange={(e) =>
                handlePatientChange("idNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>Medical Scheme</label>
            <input
              type="text"
              value={patient.scheme}
              onChange={(e) => handlePatientChange("scheme", e.target.value)}
            />
          </div>
          <div>
            <label>Scheme Option</label>
            <input
              type="text"
              value={patient.schemeOption}
              onChange={(e) =>
                handlePatientChange("schemeOption", e.target.value)
              }
            />
          </div>
          <div>
            <label>Member Number</label>
            <input
              type="text"
              value={patient.memberNumber}
              onChange={(e) =>
                handlePatientChange("memberNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>Dependant Code</label>
            <input
              type="text"
              value={patient.dependantCode}
              onChange={(e) =>
                handlePatientChange("dependantCode", e.target.value)
              }
            />
          </div>
          <div>
            <label>Contact Number</label>
            <input
              type="text"
              value={patient.contactNumber}
              onChange={(e) =>
                handlePatientChange("contactNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>Email</label>
            <input
              type="email"
              value={patient.email}
              onChange={(e) => handlePatientChange("email", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Procedure */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Procedure & Anaesthetic Details
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
          }}
        >
          <div>
            <label>Hospital</label>
            <input
              type="text"
              value={procedure.hospital}
              onChange={(e) =>
                handleProcedureChange("hospital", e.target.value)
              }
            />
          </div>
          <div>
            <label>Date of Surgery</label>
            <input
              type="date"
              value={procedure.dateOfSurgery}
              onChange={(e) =>
                handleProcedureChange("dateOfSurgery", e.target.value)
              }
            />
          </div>
          <div>
            <label>Surgeon Name</label>
            <input
              type="text"
              value={procedure.surgeonName}
              onChange={(e) =>
                handleProcedureChange("surgeonName", e.target.value)
              }
            />
          </div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label>Procedure Description</label>
            <input
              type="text"
              value={procedure.description}
              onChange={(e) =>
                handleProcedureChange("description", e.target.value)
              }
            />
          </div>
          <div>
            <label>ASA Status</label>
            <input
              type="text"
              value={procedure.asaStatus}
              onChange={(e) =>
                handleProcedureChange("asaStatus", e.target.value)
              }
            />
          </div>
          <div>
            <label>Theatre In Time (HH:MM)</label>
            <input
              type="time"
              value={procedure.theatreInTime}
              onChange={(e) =>
                handleProcedureChange("theatreInTime", e.target.value)
              }
            />
          </div>
          <div>
            <label>Theatre Out Time (HH:MM)</label>
            <input
              type="time"
              value={procedure.theatreOutTime}
              onChange={(e) =>
                handleProcedureChange("theatreOutTime", e.target.value)
              }
            />
          </div>
          <div>
            <label>Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={procedure.weightKg}
              onChange={(e) =>
                handleProcedureChange("weightKg", e.target.value)
              }
            />
          </div>
          <div>
            <label>Height (m)</label>
            <input
              type="number"
              step="0.01"
              value={procedure.heightM}
              onChange={(e) =>
                handleProcedureChange("heightM", e.target.value)
              }
            />
          </div>
          <div>
            <label>BMI (auto)</label>
            <input type="text" value={bmi} readOnly />
          </div>
        </div>
      </section>

      {/* Codes */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <h2
            style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 0 }}
          >
            Fee Codes
          </h2>
          <button
            type="button"
            onClick={addCodeRow}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid #10b981",
              background: "#ecfdf5",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            + Add code line
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.85rem",
            }}
          >
            <thead>
              <tr>
                <th>Code</th>
                <th>Description</th>
                <th>Units</th>
                <th>Rate / Unit</th>
                <th>Line Total</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => {
                const units = parseFloat(c.units) || 0;
                const rate = parseFloat(c.ratePerUnit) || 0;
                const total = units * rate;
                return (
                  <tr key={c.id}>
                    <td>
                      <input
                        type="text"
                        value={c.code}
                        onChange={(e) =>
                          handleCodeChange(c.id, "code", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={c.description}
                        onChange={(e) =>
                          handleCodeChange(
                            c.id,
                            "description",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={c.units}
                        onChange={(e) =>
                          handleCodeChange(c.id, "units", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={c.ratePerUnit}
                        onChange={(e) =>
                          handleCodeChange(
                            c.id,
                            "ratePerUnit",
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      {formatCurrency(total)}
                    </td>
                    <td>
                      {codes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCodeRow(c.id)}
                          style={{
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            color: "#dc2626",
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: "right", fontWeight: 600 }}>
                  Line subtotal:
                </td>
                <td style={{ fontWeight: 600 }}>
                  {formatCurrency(lineSubtotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* Extras & totals */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem" }}>
          Extras & Totals
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <div>
            <label>Call-out fee (R)</label>
            <input
              type="number"
              step="0.01"
              value={extras.callOutFee}
              onChange={(e) =>
                handleExtrasChange("callOutFee", e.target.value)
              }
            />
          </div>
          <div>
            <label>Travel fee (R)</label>
            <input
              type="number"
              step="0.01"
              value={extras.travelFee}
              onChange={(e) =>
                handleExtrasChange("travelFee", e.target.value)
              }
            />
          </div>
          <div>
            <label>Other fee description</label>
            <input
              type="text"
              value={extras.otherDesc}
              onChange={(e) =>
                handleExtrasChange("otherDesc", e.target.value)
              }
            />
          </div>
          <div>
            <label>Other fee amount (R)</label>
            <input
              type="number"
              step="0.01"
              value={extras.otherAmount}
              onChange={(e) =>
                handleExtrasChange("otherAmount", e.target.value)
              }
            />
          </div>
          <div>
            <label>Discount (%)</label>
            <input
              type="number"
              step="0.1"
              value={extras.discountPercentage}
              onChange={(e) =>
                handleExtrasChange("discountPercentage", e.target.value)
              }
            />
          </div>
          <div>
            <label>VAT rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={extras.vatRatePercentage}
              onChange={(e) =>
                handleExtrasChange("vatRatePercentage", e.target.value)
              }
              disabled={!extras.includeVat}
            />
          </div>
          <div>
            <label>Include VAT?</label>
            <select
              value={extras.includeVat ? "yes" : "no"}
              onChange={(e) =>
                handleExtrasChange("includeVat", e.target.value === "yes")
              }
            >
              <option value="yes">Yes (add VAT)</option>
              <option value="no">No (no VAT)</option>
            </select>
          </div>
          <div>
            <label>Quote reference number</label>
            <input
              type="text"
              value={extras.referenceNumber}
              onChange={(e) =>
                handleExtrasChange("referenceNumber", e.target.value)
              }
            />
          </div>
          <div>
            <label>Validity (days)</label>
            <input
              type="number"
              value={extras.validityDays}
              onChange={(e) =>
                handleExtrasChange("validityDays", e.target.value)
              }
            />
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Notes for patient (shown on quote)
          </label>
          <textarea
            rows={3}
            style={{ width: "100%", resize: "vertical" }}
            value={extras.notesForPatient}
            onChange={(e) =>
              handleExtrasChange("notesForPatient", e.target.value)
            }
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ display: "block", marginBottom: "0.25rem" }}>
            Internal notes (for anaesthetist / admin only)
          </label>
          <textarea
            rows={2}
            style={{ width: "100%", resize: "vertical" }}
            value={extras.notesForAnaesthetist}
            onChange={(e) =>
              handleExtrasChange("notesForAnaesthetist", e.target.value)
            }
          />
        </div>

        <div
          style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: "0.75rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "0.5rem",
            fontSize: "0.9rem",
          }}
        >
          <div>
            <strong>Subtotal before discount:</strong>
            <div>{formatCurrency(subtotalBeforeDiscount)}</div>
          </div>
          <div>
            <strong>
              Discount ({discountPercentageNum}
              %):
            </strong>
            <div>-{formatCurrency(discountAmount)}</div>
          </div>
          <div>
            <strong>Subtotal after discount:</strong>
            <div>{formatCurrency(subtotalAfterDiscount)}</div>
          </div>
          <div>
            <strong>VAT ({vatRateNum}%):</strong>
            <div>{formatCurrency(vatAmount)}</div>
          </div>
          <div>
            <strong>GRAND TOTAL (estimate):</strong>
            <div>{formatCurrency(grandTotal)}</div>
          </div>
        </div>
      </section>

      {/* Quote text output */}
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: "0.75rem",
          padding: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <h2
            style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: 0 }}
          >
            Generated Quotation Text
          </h2>
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: "0.4rem 0.8rem",
              borderRadius: "999px",
              border: "1px solid #3b82f6",
              background: "#eff6ff",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Copy to clipboard
          </button>
        </div>
        <p style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: "0.5rem" }}>
          Paste this into an email or export it later. All amounts are in South
          African Rand.
        </p>
        <textarea
          readOnly
          value={quoteText}
          rows={18}
          style={{
            width: "100%",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
            fontSize: "0.8rem",
            whiteSpace: "pre",
            resize: "vertical",
          }}
        />
      </section>

      <style>{`
        section label {
          display: block;
          font-size: 0.8rem;
          color: #4b5563;
          margin-bottom: 0.15rem;
        }
        section input,
        section select,
        section textarea {
          width: 100%;
          padding: 0.35rem 0.5rem;
          border-radius: 0.375rem;
          border: 1px solid #d1d5db;
          font-size: 0.85rem;
          box-sizing: border-box;
        }
        section input:focus,
        section select:focus,
        section textarea:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.25);
        }
        table th, table td {
          border-bottom: 1px solid #e5e7eb;
          padding: 0.35rem;
          text-align: left;
        }
        table th {
          font-weight: 600;
          font-size: 0.8rem;
          color: #4b5563;
        }
      `}</style>
    </div>
  );
}


export default App;
