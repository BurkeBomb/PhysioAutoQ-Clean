import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2pdf from 'html2pdf.js';

const TREATMENT_CODES = [
  { code: '702', shortLabel: 'Complex evaluation – first visit', description: 'Comprehensive initial evaluation and treatment planning for more complex cases (usually once per episode of care; check your coding rules).', unitPrice: 403.6 },
  { code: '501', shortLabel: 'Rehabilitation – undivided attention', description: 'Rehabilitation where the pathology requires your undivided attention with the patient for the full session.', unitPrice: 287.6 },
  { code: '325', shortLabel: 'Suction level 2 with lavage', description: 'Advanced suction with involvement of lavage, typically in a special unit situation or in a respiratory-compromised patient.', unitPrice: 231.2 },
  { code: '301', shortLabel: 'Percussion', description: 'Chest percussion as part of respiratory physiotherapy or airway clearance techniques.', unitPrice: 185.9 },
  { code: '300', shortLabel: 'Vibration', description: 'Chest vibration or related airway clearance modality as part of respiratory physiotherapy.', unitPrice: 134.5 },
  { code: '305', shortLabel: 'Manual therapy / mobilisations', description: 'Manual therapy or joint/spinal mobilisation. Configure to match how your practice uses this code.', unitPrice: 115.7 },
  { code: '307', shortLabel: 'Additional chest physio', description: 'Additional chest physiotherapy / airway clearance work (e.g. extra time or techniques).', unitPrice: 115.7 },
  { code: '315', shortLabel: 'Extended treatment session', description: 'Extended treatment session (for example 60 minutes). Adapt to the exact definition your practice follows.', unitPrice: 134.5 },
  { code: '720', shortLabel: 'Electrotherapy / heat', description: 'Electrotherapy or heat modalities such as infra-red, radiant heat or wax therapy.', unitPrice: 250.0 },
  { code: '901', shortLabel: 'Hospital / nursing visit', description: 'Visiting code when treatment is provided in a hospital, ward or nursing facility (used together with other treatment codes as per scheme rules).', unitPrice: 115.7 },
];

const PRESETS = [
  {
    id: 'standard-chest',
    label: 'Standard chest physio (ward)',
    description: 'Typical ward chest physio: percussion, vibration and suction.',
    items: [
      { code: '301', quantity: 1, sessionType: 'AM' },
      { code: '300', quantity: 1, sessionType: 'AM' },
      { code: '325', quantity: 1, sessionType: 'AM' },
    ],
  },
  {
    id: 'neuro-rehab',
    label: 'Neuro rehab session',
    description: 'Neuro / complex rehab with undivided attention and electrotherapy/heat.',
    items: [
      { code: '501', quantity: 1, sessionType: 'AM' },
      { code: '720', quantity: 1, sessionType: 'AM' },
    ],
  },
  {
    id: 'complex-first-visit',
    label: 'Complex first assessment',
    description: 'First visit for complex case – evaluation plus manual treatment.',
    items: [
      { code: '702', quantity: 1, sessionType: 'AM' },
      { code: '305', quantity: 1, sessionType: 'AM' },
    ],
  },
];

const DEFAULT_PROVIDER = {
  practiceName: 'MSC Physiotherapists',
  practitionerName: 'Marlisa Schabort',
  practiceNumber: '0211672',
  registrationNumber: '',
  vatNumber: '4880304920',
  email: 'info@venmed.co.za',
  phone: '087 802 1575',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  bankName: 'ABSA Bank',
  accountName: 'MSC Schabort',
  accountNumber: '405 5144 673',
  branchCode: '250655',
  accountType: 'Cheque account',
};

const DEFAULT_PATIENT = {
  fullName: '',
  idNumber: '',
  email: '',
  phone: '',
  medicalAid: '',
  medicalAidNumber: '',
};

const createDefaultQuoteMeta = () => {
  const today = new Date();
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const formatForInput = (date) => date.toISOString().slice(0, 10);
  const pad = (n) => String(n).padStart(2, '0');

  return {
    quoteNumber: `Q-${today.getFullYear()}${pad(today.getMonth() + 1)}-${pad(today.getDate())}`,
    date: formatForInput(today),
    validUntil: formatForInput(inSevenDays),
    notes:
      'This quote is based on current physiotherapy tariffs and the expected treatment plan. If your condition or authorisation changes, the final invoice may differ.',
  };
};

const encodeQuotePayload = (payload) => {
  try {
    const json = JSON.stringify(payload);
    return btoa(encodeURIComponent(json));
  } catch (err) {
    console.error('Failed to encode quote payload', err);
    return '';
  }
};

const decodeQuotePayload = (str) => {
  try {
    const json = decodeURIComponent(atob(str));
    return JSON.parse(json);
  } catch (err) {
    console.error('Failed to decode quote payload', err);
    return null;
  }
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(value || 0);

// 0008 second-code discount helper
const augmentItemsWithSecondCodeDiscount = (items) => {
  const qualifying = items.filter((it) => {
    const numeric = parseInt(it.code, 10);
    return !Number.isNaN(numeric) && numeric < 324 && (it.quantity || 0) > 0;
  });

  if (qualifying.length < 2) {
    return {
      itemsWithPricing: items.map((it) => ({
        ...it,
        effectiveUnitPrice: it.unitPrice || 0,
        isSecondCodeDiscount: false,
      })),
      discountedCode: null,
    };
  }

  let cheapest = qualifying[0];
  for (const it of qualifying) {
    if ((it.unitPrice || 0) < (cheapest.unitPrice || 0)) {
      cheapest = it;
    }
  }

  const discountedCode = cheapest.code;

  const itemsWithPricing = items.map((it) => {
    if (it.code === discountedCode) {
      return {
        ...it,
        effectiveUnitPrice: (it.unitPrice || 0) * 0.5,
        isSecondCodeDiscount: true,
      };
    }
    return {
      ...it,
      effectiveUnitPrice: it.unitPrice || 0,
      isSecondCodeDiscount: false,
    };
  });

  return { itemsWithPricing, discountedCode };
};

const PhysiotherapyQuoteBuilder = () => {
  const [provider, setProvider] = useState(DEFAULT_PROVIDER);
  const [patient, setPatient] = useState(DEFAULT_PATIENT);
  const [quoteMeta, setQuoteMeta] = useState(() => createDefaultQuoteMeta());
  const [plannedDays, setPlannedDays] = useState(1);
  const [items, setItems] = useState([]);
  const [selectedCode, setSelectedCode] = useState(TREATMENT_CODES[0].code);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedSessionType, setSelectedSessionType] = useState('AM');
  const [copyStatus, setCopyStatus] = useState('');
  const [isApprovalView, setIsApprovalView] = useState(false);

  const previewRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash || '';
    const match = hash.match(/quote=([^&]+)/);
    if (match && match[1]) {
      const decoded = decodeQuotePayload(match[1]);
      if (decoded) {
        if (decoded.provider) setProvider(decoded.provider);
        if (decoded.patient) setPatient(decoded.patient);
        if (decoded.quoteMeta) setQuoteMeta(decoded.quoteMeta);
        if (Array.isArray(decoded.items)) setItems(decoded.items);
        if (decoded.plannedDays) setPlannedDays(decoded.plannedDays);
        setIsApprovalView(true);
      }
    }
  }, []);

  const pricing = useMemo(() => {
    const { itemsWithPricing, discountedCode } = augmentItemsWithSecondCodeDiscount(items);
    const perDayTotal = itemsWithPricing.reduce(
      (sum, it) => sum + (it.effectiveUnitPrice || 0) * (it.quantity || 0),
      0,
    );
    const days = Number(plannedDays) > 0 ? Number(plannedDays) : 1;
    const grandTotal = perDayTotal * days;
    return { itemsWithPricing, discountedCode, perDayTotal, grandTotal, days };
  }, [items, plannedDays]);

  const { itemsWithPricing, perDayTotal, grandTotal, days } = pricing;

  const handleProviderChange = (field, value) => {
    setProvider((prev) => ({ ...prev, [field]: value }));
  };

  const handlePatientChange = (field, value) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
  };

  const handleQuoteMetaChange = (field, value) => {
    setQuoteMeta((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddItem = () => {
    const treatment = TREATMENT_CODES.find((t) => t.code === selectedCode);
    if (!treatment) return;

    const quantity = Number(selectedQuantity) || 1;
    if (quantity <= 0) return;

    const existingIndex = items.findIndex(
      (i) => i.code === treatment.code && i.sessionType === selectedSessionType,
    );

    if (existingIndex !== -1) {
      const next = [...items];
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + quantity,
      };
      setItems(next);
    } else {
      setItems((prev) => [
        ...prev,
        {
          code: treatment.code,
          shortLabel: treatment.shortLabel,
          description: treatment.description,
          unitPrice: treatment.unitPrice,
          quantity,
          sessionType: selectedSessionType,
        },
      ]);
    }
  };

  const handleApplyPreset = (presetId) => {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setItems((prev) => {
      const next = [...prev];
      preset.items.forEach((presetItem) => {
        const treatment = TREATMENT_CODES.find((t) => t.code === presetItem.code);
        if (!treatment) return;

        const existingIndex = next.findIndex(
          (i) => i.code === presetItem.code && i.sessionType === presetItem.sessionType,
        );
        const qtyToAdd = Number(presetItem.quantity) || 0;
        if (qtyToAdd <= 0) return;

        if (existingIndex !== -1) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + qtyToAdd,
          };
        } else {
          next.push({
            code: treatment.code,
            shortLabel: treatment.shortLabel,
            description: treatment.description,
            unitPrice: treatment.unitPrice,
            quantity: qtyToAdd,
            sessionType: presetItem.sessionType,
          });
        }
      });
      return next;
    });
  };

  const handleUpdateItemQuantity = (index, quantity) => {
    const value = Number(quantity) || 0;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, quantity: value < 0 ? 0 : value } : item,
      ),
    );
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDownloadPdf = () => {
    if (!previewRef.current) return;

    const opt = {
      margin: 10,
      filename: `${quoteMeta.quoteNumber || 'physio-quote'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    };

    html2pdf().set(opt).from(previewRef.current).save();
  };

  const handleCopyApprovalLink = async () => {
    if (typeof window === 'undefined') return;

    if (!items.length) {
      setCopyStatus('Add at least one treatment before generating a link.');
      setTimeout(() => setCopyStatus(''), 5000);
      return;
    }

    const payload = { provider, patient, quoteMeta, items, plannedDays: days };
    const encoded = encodeQuotePayload(payload);
    if (!encoded) {
      setCopyStatus('Unable to create approval link. Refresh and try again.');
      setTimeout(() => setCopyStatus(''), 5000);
      return;
    }

    const url = `${window.location.origin}${window.location.pathname}#quote=${encoded}`;

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        setCopyStatus('Approval link copied to clipboard.');
      } else {
        window.prompt('Copy this approval link:', url);
        setCopyStatus('Approval link ready – copied or shared.');
      }
    } catch (err) {
      console.error('Clipboard error', err);
      window.prompt('Copy this approval link:', url);
      setCopyStatus('Approval link ready – copied or shared.');
    }

    setTimeout(() => setCopyStatus(''), 5000);
  };

  const handleEmailPatient = () => {
    if (typeof window === 'undefined') return;

    if (!patient.email) {
      setCopyStatus('Please add the patient email under Patient details first.');
      setTimeout(() => setCopyStatus(''), 5000);
      return;
    }

    if (!items.length) {
      setCopyStatus('Add at least one treatment item before emailing the quote.');
      setTimeout(() => setCopyStatus(''), 5000);
      return;
    }

    const payload = { provider, patient, quoteMeta, items, plannedDays: days };
    const encoded = encodeQuotePayload(payload);
    const baseUrl = `${window.location.origin}${window.location.pathname}`;
    const approvalUrl = encoded ? `${baseUrl}#quote=${encoded}` : baseUrl;

    const subject = `Physiotherapy quote – ${quoteMeta.quoteNumber || ''}`.trim();
    const perDayText = formatCurrency(perDayTotal);
    const grandText = formatCurrency(grandTotal);

    const bodyLines = [
      `Dear ${patient.fullName || 'patient'},`,
      '',
      `Below is your physiotherapy quote from ${provider.practiceName || 'our practice'}.`,
      '',
      `Quote reference: ${quoteMeta.quoteNumber || ''}`,
      `Estimated per-day total: ${perDayText}`,
      `Planned days: ${days}`,
      `Estimated grand total: ${grandText}`,
      '',
      'You can view the full quote using the following link:',
      approvalUrl,
      '',
      'If you are happy to proceed, please reply to this email confirming your approval, or open the link and use the "Approve quote via email" button.',
      '',
      'Kind regards,',
      provider.practitionerName || provider.practiceName || '',
    ];

    const mailto = [
      'mailto:',
      encodeURIComponent(patient.email),
      '?subject=',
      encodeURIComponent(subject),
      '&body=',
      encodeURIComponent(bodyLines.join('\n')),
    ].join('');

    window.location.href = mailto;
  };

  const handleApproveQuote = () => {
    if (typeof window === 'undefined') return;

    const subject = `Quote approval – ${quoteMeta.quoteNumber || ''}`.trim();
    const grandText = formatCurrency(grandTotal);

    const bodyLines = [
      `I, ${patient.fullName || '[patient name]'}, ID ${patient.idNumber || '[ID number]'},`,
      `approve the physiotherapy quote (${quoteMeta.quoteNumber || 'reference'}) with an estimated total of ${grandText} over ${days} day(s).`,
      '',
      `Practice: ${provider.practiceName}`,
      `Physiotherapist: ${provider.practitionerName}`,
      '',
      'I understand that the final invoiced amount may differ if the treatment plan or medical aid rules change.',
      '',
      'Signed electronically,',
      patient.fullName || '',
      new Date().toLocaleDateString('en-ZA'),
    ];

    const mailto = [
      'mailto:',
      encodeURIComponent(provider.email || ''),
      '?subject=',
      encodeURIComponent(subject),
      '&body=',
      encodeURIComponent(bodyLines.join('\n')),
    ].join('');

    window.location.href = mailto;
  };

  const isReadOnly = isApprovalView;

  return (
    <div className="qb-app">
      <div className="qb-shell">
        <header className="qb-header">
          <div className="qb-logo">
            <div className="qb-logo-mark">Φ</div>
            <div className="qb-logo-text">
              <div className="qb-logo-title">PhysioAutoQ</div>
              <div className="qb-logo-subtitle">MSC Physiotherapists – Quote Builder</div>
            </div>
          </div>
          <div className="qb-header-text">
            <h1>Physiotherapy Quote Builder</h1>
            <p>
              Capture provider, patient and treatment details with real MSC tariffs, apply the 0008
              second-code rule automatically, and share a clean quote via PDF or approval link.
            </p>
          </div>
        </header>

        <main className="qb-main">
          <section className="qb-panel qb-form-panel">
            <div className="qb-section">
              <h2>Provider details</h2>
              <div className="qb-grid qb-grid-2">
                <label>
                  Practice name
                  <input
                    type="text"
                    value={provider.practiceName}
                    onChange={(e) => handleProviderChange('practiceName', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Physiotherapist
                  <input
                    type="text"
                    value={provider.practitionerName}
                    onChange={(e) => handleProviderChange('practitionerName', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Practice number
                  <input
                    type="text"
                    value={provider.practiceNumber}
                    onChange={(e) => handleProviderChange('practiceNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Registration number
                  <input
                    type="text"
                    value={provider.registrationNumber}
                    onChange={(e) => handleProviderChange('registrationNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  VAT number
                  <input
                    type="text"
                    value={provider.vatNumber}
                    onChange={(e) => handleProviderChange('vatNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email"
                    value={provider.email}
                    onChange={(e) => handleProviderChange('email', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel"
                    value={provider.phone}
                    onChange={(e) => handleProviderChange('phone', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
              </div>

              <div className="qb-grid qb-grid-3 qb-grid-stack-sm">
                <label>
                  Address line 1
                  <input
                    type="text"
                    value={provider.addressLine1}
                    onChange={(e) => handleProviderChange('addressLine1', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Address line 2
                  <input
                    type="text"
                    value={provider.addressLine2}
                    onChange={(e) => handleProviderChange('addressLine2', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  City
                  <input
                    type="text"
                    value={provider.city}
                    onChange={(e) => handleProviderChange('city', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Postal code
                  <input
                    type="text"
                    value={provider.postalCode}
                    onChange={(e) => handleProviderChange('postalCode', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
              </div>
            </div>

            <div className="qb-section">
              <h2>Patient details</h2>
              <div className="qb-grid qb-grid-2 qb-grid-stack-sm">
                <label>
                  Patient name
                  <input
                    type="text"
                    value={patient.fullName}
                    onChange={(e) => handlePatientChange('fullName', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  ID / Passport
                  <input
                    type="text"
                    value={patient.idNumber}
                    onChange={(e) => handlePatientChange('idNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Patient email
                  <input
                    type="email"
                    value={patient.email}
                    onChange={(e) => handlePatientChange('email', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Patient phone
                  <input
                    type="tel"
                    value={patient.phone}
                    onChange={(e) => handlePatientChange('phone', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Medical aid
                  <input
                    type="text"
                    value={patient.medicalAid}
                    onChange={(e) => handlePatientChange('medicalAid', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Medical aid number
                  <input
                    type="text"
                    value={patient.medicalAidNumber}
                    onChange={(e) => handlePatientChange('medicalAidNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
              </div>
            </div>

            <div className="qb-section">
              <h2>Quote details</h2>
              <div className="qb-grid qb-grid-3 qb-grid-stack-sm">
                <label>
                  Quote number
                  <input
                    type="text"
                    value={quoteMeta.quoteNumber}
                    onChange={(e) => handleQuoteMetaChange('quoteNumber', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Quote date
                  <input
                    type="date"
                    value={quoteMeta.date}
                    onChange={(e) => handleQuoteMetaChange('date', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Valid until
                  <input
                    type="date"
                    value={quoteMeta.validUntil}
                    onChange={(e) => handleQuoteMetaChange('validUntil', e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
                <label>
                  Planned treatment days
                  <input
                    type="number"
                    min="1"
                    value={plannedDays}
                    onChange={(e) => setPlannedDays(e.target.value)}
                    disabled={isReadOnly}
                  />
                </label>
              </div>
              <label>
                Notes to patient
                <textarea
                  rows={3}
                  value={quoteMeta.notes}
                  onChange={(e) => handleQuoteMetaChange('notes', e.target.value)}
                  disabled={isReadOnly}
                />
              </label>
            </div>

            {!isApprovalView && (
              <div className="qb-section">
                <h2>Add treatment items</h2>

                <div className="qb-presets-row">
                  <span className="qb-presets-label">Quick presets:</span>
                  <div className="qb-presets-buttons">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className="qb-btn qb-btn-pill"
                        onClick={() => handleApplyPreset(preset.id)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="qb-treatments-row">
                  <label>
                    Tariff code
                    <select
                      value={selectedCode}
                      onChange={(e) => setSelectedCode(e.target.value)}
                    >
                      {TREATMENT_CODES.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.code} – {t.shortLabel} ({formatCurrency(t.unitPrice)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      value={selectedQuantity}
                      onChange={(e) => setSelectedQuantity(e.target.value)}
                    />
                  </label>
                  <label>
                    Session
                    <select
                      value={selectedSessionType}
                      onChange={(e) => setSelectedSessionType(e.target.value)}
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                      <option value="Full">Full day / unspecified</option>
                    </select>
                  </label>
                  <button type="button" className="qb-btn qb-btn-accent" onClick={handleAddItem}>
                    Add item
                  </button>
                </div>

                {items.length > 0 && (
                  <>
                    <div className="qb-items-table-wrapper">
                      <table className="qb-items-table">
                        <thead>
                          <tr>
                            <th>Code</th>
                            <th>Description</th>
                            <th>Session</th>
                            <th>Unit fee (ZAR)</th>
                            <th>Quantity</th>
                            <th>Line total (per day)</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, index) => {
                            const priced = itemsWithPricing[index] || item;
                            const effectiveUnit =
                              priced.effectiveUnitPrice ?? item.unitPrice ?? 0;
                            return (
                              <tr key={`${item.code}-${item.sessionType}-${index}`}>
                                <td>{item.code}</td>
                                <td>
                                  {item.shortLabel}
                                  {priced.isSecondCodeDiscount && (
                                    <span className="qb-pill qb-pill-small">
                                      0008 – 50% second code
                                    </span>
                                  )}
                                </td>
                                <td>{item.sessionType || '—'}</td>
                                <td>{formatCurrency(effectiveUnit)}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.quantity}
                                    onChange={(e) =>
                                      handleUpdateItemQuantity(index, e.target.value)
                                    }
                                  />
                                </td>
                                <td>{formatCurrency(effectiveUnit * item.quantity)}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="qb-link-btn"
                                    onClick={() => handleRemoveItem(index)}
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="qb-hint">
                      0008 rule: when there are at least two treatment codes with numbers &lt; 324,
                      the cheapest one is automatically discounted by 50% (marked as
                      “0008 – 50% second code”).
                    </p>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="qb-panel qb-preview-panel">
            {isApprovalView && (
              <div className="qb-approval-banner">
                <h2>Quote approval</h2>
                <p>
                  Please review the quote below. If you&apos;re happy to proceed, click{' '}
                  <strong>&quot;Approve quote via email&quot;</strong> to send confirmation to your
                  physio.
                </p>
              </div>
            )}

            <div className="qb-preview-card" ref={previewRef}>
              <div className="qb-preview-header">
                <div className="qb-preview-logo">
                  <div className="qb-logo-mark">Φ</div>
                  <div>
                    <div className="qb-logo-title">{provider.practiceName}</div>
                    <div className="qb-logo-subtitle">
                      {provider.practitionerName} &bull; Physio practice no.{' '}
                      {provider.practiceNumber}
                    </div>
                  </div>
                </div>
                <div className="qb-preview-meta">
                  <div>
                    <span className="qb-label">Quote no.</span>
                    <span className="qb-value">{quoteMeta.quoteNumber}</span>
                  </div>
                  <div>
                    <span className="qb-label">Date</span>
                    <span className="qb-value">{quoteMeta.date}</span>
                  </div>
                  <div>
                    <span className="qb-label">Valid until</span>
                    <span className="qb-value">{quoteMeta.validUntil}</span>
                  </div>
                </div>
              </div>

              <div className="qb-preview-body">
                <div className="qb-preview-columns">
                  <div>
                    <h3>From</h3>
                    <p>
                      <strong>{provider.practiceName}</strong>
                      <br />
                      {provider.practitionerName}
                      <br />
                      Practice no. {provider.practiceNumber}
                      <br />
                      Reg. {provider.registrationNumber || '—'}
                      <br />
                      VAT no. {provider.vatNumber || '—'}
                    </p>
                    <p>
                      {provider.addressLine1}
                      <br />
                      {provider.addressLine2 && (
                        <>
                          {provider.addressLine2}
                          <br />
                        </>
                      )}
                      {provider.city} {provider.postalCode}
                    </p>
                    <p>
                      Tel: {provider.phone}
                      <br />
                      Email: {provider.email}
                    </p>
                  </div>
                  <div>
                    <h3>To</h3>
                    <p>
                      <strong>{patient.fullName || 'Patient name'}</strong>
                      <br />
                      ID / Passport: {patient.idNumber || '—'}
                    </p>
                    <p>
                      Medical aid: {patient.medicalAid || '—'}
                      <br />
                      Membership no.: {patient.medicalAidNumber || '—'}
                    </p>
                    <p>
                      Email: {patient.email || '—'}
                      <br />
                      Phone: {patient.phone || '—'}
                    </p>
                  </div>
                </div>

                <h3 className="qb-table-heading">Treatment plan & estimated costs (per day)</h3>
                <table className="qb-preview-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Session</th>
                      <th>Qty</th>
                      <th>Unit fee</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsWithPricing.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="qb-empty">
                          No treatment items added yet.
                        </td>
                      </tr>
                    ) : (
                      itemsWithPricing.map((item, index) => (
                        <tr key={`${item.code}-${item.sessionType}-${index}`}>
                          <td>{item.code}</td>
                          <td>
                            {item.description}
                            {item.isSecondCodeDiscount && (
                              <span className="qb-pill qb-pill-small">
                                0008 – 50% second code
                              </span>
                            )}
                          </td>
                          <td>{item.sessionType || '—'}</td>
                          <td>{item.quantity}</td>
                          <td>{formatCurrency(item.effectiveUnitPrice)}</td>
                          <td>{formatCurrency(item.effectiveUnitPrice * item.quantity)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={5} className="qb-total-label">
                        Estimated total per day
                      </td>
                      <td className="qb-total-value">{formatCurrency(perDayTotal)}</td>
                    </tr>
                  </tfoot>
                </table>

                <div className="qb-summary">
                  <p>
                    Planned treatment days: <strong>{days}</strong>
                  </p>
                  <p>
                    Estimated grand total (per day × days):{' '}
                    <strong>{formatCurrency(grandTotal)}</strong>
                  </p>
                </div>

                <div className="qb-notes">
                  <h4>Notes</h4>
                  <p>{quoteMeta.notes}</p>
                  <p className="qb-disclaimer">
                    Quote valid for 7 days and subject to change due to unforeseen circumstances or
                    changes to your medical scheme&apos;s rules. This is an estimate, not a final
                    account.
                  </p>
                </div>

                <div className="qb-bank">
                  <h4>Bank details</h4>
                  <p>
                    <strong>Account name:</strong> {provider.accountName}
                    <br />
                    <strong>Bank:</strong> {provider.bankName}
                    <br />
                    <strong>Account type:</strong> {provider.accountType || 'Cheque account'}
                    <br />
                    <strong>Account no.:</strong> {provider.accountNumber}
                    <br />
                    <strong>Branch code:</strong> {provider.branchCode}
                  </p>
                  <p className="qb-bank-note">
                    Please use your name and quote number ({quoteMeta.quoteNumber}) as payment
                    reference.
                  </p>
                </div>

                <div className="qb-signature-row">
                  <div>
                    <h4>Patient acknowledgement</h4>
                    <p>
                      By accepting this quote, you acknowledge that you have been informed of the
                      expected costs for the above-listed physiotherapy services.
                    </p>
                    <div className="qb-signature-line">
                      Patient signature / name:&nbsp; __________________________
                    </div>
                    <div className="qb-signature-line">
                      Date:&nbsp; __________________________
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="qb-actions">
              {!isApprovalView && (
                <>
                  <button
                    type="button"
                    className="qb-btn qb-btn-primary"
                    onClick={handleDownloadPdf}
                  >
                    Download quote as PDF
                  </button>
                  <button
                    type="button"
                    className="qb-btn qb-btn-outline"
                    onClick={handleCopyApprovalLink}
                  >
                    Copy approval link
                  </button>
                  <button
                    type="button"
                    className="qb-btn qb-btn-outline"
                    onClick={handleEmailPatient}
                  >
                    Email quote to patient
                  </button>
                </>
              )}

              {isApprovalView && (
                <button
                  type="button"
                  className="qb-btn qb-btn-primary"
                  onClick={handleApproveQuote}
                >
                  Approve quote via email
                </button>
              )}

              {copyStatus && <div className="qb-status">{copyStatus}</div>}
            </div>
          </section>
        </main>

        <footer className="qb-footer">
          <span>
            Tariff values in this tool must be set to your own current MSC Physiotherapists fee
            structure and will differ per medical scheme and year.
          </span>
        </footer>
      </div>
    </div>
  );
};

export default PhysiotherapyQuoteBuilder;
