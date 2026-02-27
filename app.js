/* Newton Investment Analyzer v2 */
const TOWN = "Newton";
const BG = "#1B2A4A";
const ACCENT = "#D4A843";

const PROPERTIES = window.__PROPERTIES__ || [];

// Grade mapping
function getGrade(score) {
  if (score >= 11) return "A";
  if (score >= 9) return "B";
  if (score >= 7) return "C";
  if (score >= 5) return "D";
  return "F";
}

function fmt(n) {
  if (n == null || isNaN(n)) return "N/A";
  return "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return "N/A";
  return Number(n).toFixed(1) + "%";
}

function fmtNum(n) {
  if (n == null || isNaN(n)) return "N/A";
  return Number(n).toLocaleString("en-US");
}

// Compute town medians
const validSqftProps = PROPERTIES.filter(p => p.sqft > 0);
const medianPSF = validSqftProps.length > 0
  ? validSqftProps.map(p => p.pricePerSqft || (p.assessedValue / p.sqft)).sort((a,b) => a - b)[Math.floor(validSqftProps.length / 2)]
  : 300;
const avgRentPSF = 1.5; // ~$1.50/sqft/month typical estimate

// ── Rotate Prompt ───────────────────────────
function RotatePrompt({ onContinue }) {
  const [show, setShow] = React.useState(true);

  React.useEffect(() => {
    const check = () => {
      if (window.innerWidth > window.innerHeight) {
        setShow(false);
        onContinue();
      }
    };
    window.addEventListener("resize", check);
    check();
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!show) return null;

  return React.createElement("div", { className: "rotate-screen" },
    React.createElement("svg", { viewBox: "0 0 64 64" },
      React.createElement("path", { d: "M32 4L12 20h12v20h16V20h12L32 4zM8 44v8c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4v-8H8z" })
    ),
    React.createElement("h1", null, TOWN),
    React.createElement("p", null, "Investment Analyzer"),
    React.createElement("svg", { className: "phone-icon", viewBox: "0 0 64 64", style: { fill: ACCENT } },
      React.createElement("rect", { x: 18, y: 8, width: 28, height: 48, rx: 4, fill: "none", stroke: ACCENT, strokeWidth: 3 }),
      React.createElement("circle", { cx: 32, cy: 50, r: 2, fill: ACCENT })
    ),
    React.createElement("h2", { style: { fontSize: "1.1rem", marginTop: "0.5rem" } }, "Rotate to Landscape"),
    React.createElement("p", { style: { fontSize: ".8rem" } }, "This app works best in landscape orientation"),
    React.createElement("span", {
      className: "continue-link",
      onClick: () => { setShow(false); onContinue(); }
    }, "Continue in portrait anyway")
  );
}

// ── Intro Guide ─────────────────────────────
const GUIDE_PAGES = [
  { title: "Welcome", text: `${TOWN} Investment Analyzer helps you evaluate real estate investment opportunities across the city. Browse properties, analyze deals, and compare investment strategies.` },
  { title: "Investment Scoring", text: "Each property is scored 0-12 based on value metrics: price per sqft relative to town median, property type, assessed value range, and other factors. Grades: A (11-12), B (9-10), C (7-8), D (5-6), F (0-4)." },
  { title: "How to Use", text: "Search and filter properties in the table. Tap any row to open detailed analysis with Flip, Hold, BRRRR, and Value-Add strategies. Adjust inputs and recalculate. Star properties to shortlist and compare side-by-side." },
  { title: "Data Notes", text: "Property data comes from public assessment records. Estimated values (ARV, rent, renovation costs) are algorithmic projections for screening purposes only. Always perform your own due diligence before investing." }
];

function IntroGuide({ onClose }) {
  const [page, setPage] = React.useState(0);

  return React.createElement("div", { className: "guide-overlay" },
    React.createElement("div", { className: "guide-card" },
      React.createElement("button", { className: "close-btn", onClick: onClose }, "\u00D7"),
      React.createElement("h2", null, GUIDE_PAGES[page].title),
      React.createElement("p", null, GUIDE_PAGES[page].text),
      React.createElement("div", { className: "guide-nav" },
        React.createElement("button", {
          className: "secondary",
          style: { visibility: page === 0 ? "hidden" : "visible" },
          onClick: () => setPage(page - 1)
        }, "Back"),
        React.createElement("div", { className: "guide-dots" },
          GUIDE_PAGES.map((_, i) =>
            React.createElement("span", { key: i, className: i === page ? "active" : "" })
          )
        ),
        React.createElement("button", {
          onClick: () => page === GUIDE_PAGES.length - 1 ? onClose() : setPage(page + 1)
        }, page === GUIDE_PAGES.length - 1 ? "Get Started" : "Next")
      )
    )
  );
}

// ── Property Detail Modal ───────────────────
function PropertyModal({ property: p, onClose }) {
  const [tab, setTab] = React.useState("flip");
  const [inputs, setInputs] = React.useState({
    purchasePrice: String(p.assessedValue || 0),
    renoBudget: String(p.estRenoBudget || Math.round((p.sqft || 0) * 85)),
    arv: String(p.estARV || Math.round((p.sqft || 0) * medianPSF * 1.2)),
    monthlyRent: String(p.estMonthlyRent || Math.round((p.sqft || 0) * avgRentPSF)),
    interestRate: "6.0",
    downPayment: "25",
    holdingMonths: "6",
    commission: "4.0"
  });
  const [results, setResults] = React.useState(null);

  React.useEffect(() => { recalculate(); }, [tab]);

  function handleInput(field, val) {
    setInputs(prev => ({ ...prev, [field]: val }));
  }

  function recalculate() {
    const pp = parseFloat(inputs.purchasePrice) || 0;
    const reno = parseFloat(inputs.renoBudget) || 0;
    const arv = parseFloat(inputs.arv) || 0;
    const rent = parseFloat(inputs.monthlyRent) || 0;
    const rate = (parseFloat(inputs.interestRate) || 6) / 100;
    const dp = (parseFloat(inputs.downPayment) || 25) / 100;
    const months = parseInt(inputs.holdingMonths) || 6;
    const commPct = (parseFloat(inputs.commission) || 4) / 100;

    const downAmt = pp * dp;
    const loanAmt = pp * (1 - dp);
    const monthlyRate = rate / 12;
    const mortgagePayment = loanAmt > 0 && monthlyRate > 0
      ? loanAmt * (monthlyRate * Math.pow(1 + monthlyRate, 360)) / (Math.pow(1 + monthlyRate, 360) - 1)
      : 0;

    if (tab === "flip") {
      const holdingCost = mortgagePayment * months;
      const purchaseComm = pp * commPct;
      const sellingCost = arv * 0.05;
      const totalCost = pp + reno + holdingCost + purchaseComm + sellingCost;
      const profit = arv - totalCost;
      const cashInvested = downAmt + reno + purchaseComm;
      const roi = cashInvested > 0 ? (profit / cashInvested) * 100 : 0;
      setResults({
        type: "flip",
        purchasePrice: pp, renoBudget: reno, holdingCost, purchaseComm, sellingCost, totalCost, arv, profit, cashInvested, roi
      });
    } else if (tab === "hold") {
      const monthlyTax = (pp * 0.012) / 12;
      const monthlyInsurance = (pp * 0.005) / 12;
      const maintenance = rent * 0.1;
      const vacancy = rent * 0.05;
      const monthlyCashFlow = rent - mortgagePayment - monthlyTax - monthlyInsurance - maintenance - vacancy;
      const annualRent = rent * 12;
      const annualExpenses = (monthlyTax + monthlyInsurance + maintenance + vacancy) * 12;
      const noi = annualRent - annualExpenses;
      const capRate = pp > 0 ? (noi / pp) * 100 : 0;
      const grossYield = pp > 0 ? (annualRent / pp) * 100 : 0;
      const annualCashFlow = monthlyCashFlow * 12;
      const cashOnCash = downAmt > 0 ? (annualCashFlow / downAmt) * 100 : 0;
      setResults({
        type: "hold",
        rent, mortgagePayment, monthlyTax, monthlyInsurance, maintenance, vacancy,
        monthlyCashFlow, noi, capRate, grossYield, cashOnCash, annualCashFlow
      });
    } else if (tab === "brrrr") {
      const closingCosts = pp * 0.03;
      const cashIn = downAmt + reno + closingCosts;
      const refiValue = arv * 0.75;
      const cashLeft = cashIn - refiValue;
      const refiLoan = refiValue;
      const refiMonthlyRate = rate / 12;
      const refiPayment = refiLoan > 0 && refiMonthlyRate > 0
        ? refiLoan * (refiMonthlyRate * Math.pow(1 + refiMonthlyRate, 360)) / (Math.pow(1 + refiMonthlyRate, 360) - 1)
        : 0;
      const monthlyTax = (arv * 0.012) / 12;
      const monthlyInsurance = (arv * 0.005) / 12;
      const postRefiCashFlow = (parseFloat(inputs.monthlyRent) || 0) - refiPayment - monthlyTax - monthlyInsurance - ((parseFloat(inputs.monthlyRent) || 0) * 0.15);
      setResults({
        type: "brrrr",
        cashIn, downAmt, reno, closingCosts, refiValue, cashLeft, refiPayment, postRefiCashFlow, arv
      });
    } else if (tab === "valueadd") {
      const beforeValue = pp;
      const afterValue = arv;
      const appreciation = afterValue - beforeValue;
      const equityCreated = appreciation - reno;
      const forcedAppPct = beforeValue > 0 ? (appreciation / beforeValue) * 100 : 0;
      const roiOnReno = reno > 0 ? (appreciation / reno) * 100 : 0;
      setResults({
        type: "valueadd",
        beforeValue, afterValue, appreciation, reno, equityCreated, forcedAppPct, roiOnReno
      });
    }
  }

  const tabs = ["flip", "hold", "brrrr", "valueadd"];
  const tabLabels = { flip: "Flip", hold: "Hold", brrrr: "BRRRR", valueadd: "Value-Add" };

  const grade = getGrade(p.investmentScore || 0);

  function renderResults() {
    if (!results) return null;
    const cards = [];
    if (results.type === "flip") {
      cards.push(
        { label: "Purchase Price", value: fmt(results.purchasePrice) },
        { label: "Reno Budget", value: fmt(results.renoBudget) },
        { label: "Holding Cost", value: fmt(results.holdingCost) },
        { label: "Purchase Comm.", value: fmt(results.purchaseComm) },
        { label: "Selling Cost (5%)", value: fmt(results.sellingCost) },
        { label: "Total Cost", value: fmt(results.totalCost) },
        { label: "ARV", value: fmt(results.arv) },
        { label: "Profit", value: fmt(results.profit), pos: results.profit >= 0 },
        { label: "Cash Invested", value: fmt(results.cashInvested) },
        { label: "ROI", value: fmtPct(results.roi), pos: results.roi >= 0 }
      );
    } else if (results.type === "hold") {
      cards.push(
        { label: "Monthly Rent", value: fmt(results.rent) },
        { label: "Mortgage", value: fmt(results.mortgagePayment) },
        { label: "Tax (monthly)", value: fmt(results.monthlyTax) },
        { label: "Insurance", value: fmt(results.monthlyInsurance) },
        { label: "Maintenance (10%)", value: fmt(results.maintenance) },
        { label: "Vacancy (5%)", value: fmt(results.vacancy) },
        { label: "Monthly Cash Flow", value: fmt(results.monthlyCashFlow), pos: results.monthlyCashFlow >= 0 },
        { label: "NOI", value: fmt(results.noi), pos: results.noi >= 0 },
        { label: "Cap Rate", value: fmtPct(results.capRate) },
        { label: "Gross Yield", value: fmtPct(results.grossYield) },
        { label: "Cash-on-Cash", value: fmtPct(results.cashOnCash), pos: results.cashOnCash >= 0 }
      );
    } else if (results.type === "brrrr") {
      cards.push(
        { label: "Down Payment", value: fmt(results.downAmt) },
        { label: "Reno Budget", value: fmt(results.reno) },
        { label: "Closing Costs", value: fmt(results.closingCosts) },
        { label: "Total Cash In", value: fmt(results.cashIn) },
        { label: "Refi @ 75% ARV", value: fmt(results.refiValue) },
        { label: "Cash Left in Deal", value: fmt(results.cashLeft), pos: results.cashLeft <= 0 },
        { label: "Refi Payment", value: fmt(results.refiPayment) },
        { label: "Post-Refi Cash Flow", value: fmt(results.postRefiCashFlow), pos: results.postRefiCashFlow >= 0 }
      );
    } else if (results.type === "valueadd") {
      cards.push(
        { label: "Before Value", value: fmt(results.beforeValue) },
        { label: "After Value (ARV)", value: fmt(results.afterValue) },
        { label: "Forced Appreciation", value: fmt(results.appreciation), pos: results.appreciation >= 0 },
        { label: "Reno Cost", value: fmt(results.reno) },
        { label: "Equity Created", value: fmt(results.equityCreated), pos: results.equityCreated >= 0 },
        { label: "Appreciation %", value: fmtPct(results.forcedAppPct) },
        { label: "ROI on Reno", value: fmtPct(results.roiOnReno) }
      );
    }
    return React.createElement("div", { className: "results-section" },
      React.createElement("h3", null, tabLabels[tab] + " Analysis"),
      React.createElement("div", { className: "results-grid" },
        cards.map((c, i) =>
          React.createElement("div", { key: i, className: "result-card" },
            React.createElement("div", { className: "label" }, c.label),
            React.createElement("div", {
              className: "value" + (c.pos === true ? " positive" : c.pos === false ? " negative" : "")
            }, c.value)
          )
        )
      )
    );
  }

  const inputFields = [
    { key: "purchasePrice", label: "Purchase Price ($)" },
    { key: "renoBudget", label: "Reno Budget ($)" },
    { key: "arv", label: "ARV ($)" },
    { key: "monthlyRent", label: "Monthly Rent ($)" },
    { key: "interestRate", label: "Interest Rate (%)" },
    { key: "downPayment", label: "Down Payment (%)" },
    { key: "holdingMonths", label: "Holding Months" },
    { key: "commission", label: "Commission (%)" }
  ];

  return React.createElement("div", { className: "modal-overlay", onClick: (e) => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement("div", { className: "modal", onClick: e => e.stopPropagation() },
      React.createElement("div", { className: "modal-header" },
        React.createElement("div", { className: "prop-info" },
          React.createElement("h2", null, p.address),
          React.createElement("p", null, [
            p.village || TOWN, p.zip ? `, ${p.zip}` : "",
            ` | ${p.homeType || "N/A"}`,
            p.owner ? ` | ${p.owner}` : "",
            ` | Score: ${p.investmentScore || 0} (${grade})`
          ].join(""))
        ),
        React.createElement("button", { className: "close-modal", onClick: onClose }, "\u00D7")
      ),
      React.createElement("div", { className: "strategy-tabs" },
        tabs.map(t =>
          React.createElement("button", {
            key: t, className: tab === t ? "active" : "",
            onClick: () => setTab(t)
          }, tabLabels[t])
        )
      ),
      React.createElement("div", { className: "modal-body" },
        React.createElement("div", { className: "inputs-grid" },
          inputFields.map(f =>
            React.createElement("div", { key: f.key, className: "input-group" },
              React.createElement("label", null, f.label),
              React.createElement("input", {
                type: "text",
                inputMode: "decimal",
                value: inputs[f.key],
                onChange: (e) => handleInput(f.key, e.target.value)
              })
            )
          )
        ),
        React.createElement("button", { className: "recalc-btn", onClick: recalculate }, "Recalculate"),
        renderResults()
      )
    )
  );
}

// ── Compare Panel ───────────────────────────
function ComparePanel({ properties, onClose }) {
  const metrics = [
    { label: "Address", fn: p => p.address },
    { label: "Type", fn: p => p.homeType || "N/A" },
    { label: "Area", fn: p => p.village || "N/A" },
    { label: "Assessed Value", fn: p => fmt(p.assessedValue) },
    { label: "Sqft", fn: p => fmtNum(p.sqft) },
    { label: "Price/Sqft", fn: p => fmt(p.pricePerSqft) },
    { label: "Year Built", fn: p => p.yearBuilt || "N/A" },
    { label: "Lot Size", fn: p => p.lotSize ? p.lotSize + " ac" : "N/A" },
    { label: "Score", fn: p => p.investmentScore || 0 },
    { label: "Grade", fn: p => getGrade(p.investmentScore || 0) },
    { label: "Est. ARV", fn: p => fmt(p.estARV) },
    { label: "Est. Reno", fn: p => fmt(p.estRenoBudget) },
    { label: "Est. Profit", fn: p => fmt(p.estProfit) },
    { label: "Est. ROI", fn: p => p.estROI ? fmtPct(p.estROI) : "N/A" },
    { label: "Monthly Rent", fn: p => fmt(p.estMonthlyRent) },
    { label: "Gross Yield", fn: p => p.estGrossYield ? fmtPct(p.estGrossYield) : "N/A" },
    { label: "Monthly Cash Flow", fn: p => fmt(p.estMonthlyCashflow) }
  ];

  return React.createElement("div", { className: "compare-overlay", onClick: e => { if (e.target === e.currentTarget) onClose(); } },
    React.createElement("div", { className: "compare-panel" },
      React.createElement("button", { className: "close-modal", onClick: onClose }, "\u00D7"),
      React.createElement("h2", null, "Compare Properties"),
      React.createElement("table", { className: "compare-table" },
        React.createElement("thead", null,
          React.createElement("tr", null,
            React.createElement("th", null, "Metric"),
            properties.map((p, i) => React.createElement("th", { key: i }, p.address))
          )
        ),
        React.createElement("tbody", null,
          metrics.map((m, i) =>
            React.createElement("tr", { key: i },
              React.createElement("td", { style: { color: ACCENT, fontWeight: 600 } }, m.label),
              properties.map((p, j) => React.createElement("td", { key: j }, m.fn(p)))
            )
          )
        )
      )
    )
  );
}

// ── Main App ────────────────────────────────
function App() {
  const [phase, setPhase] = React.useState("rotate"); // rotate | guide | app
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [gradeFilter, setGradeFilter] = React.useState("all");
  const [areaFilter, setAreaFilter] = React.useState("all");
  const [sortCol, setSortCol] = React.useState("investmentScore");
  const [sortDir, setSortDir] = React.useState("desc");
  const [selectedProp, setSelectedProp] = React.useState(null);
  const [shortlist, setShortlist] = React.useState([]);
  const [showShortlist, setShowShortlist] = React.useState(false);
  const [showCompare, setShowCompare] = React.useState(false);
  const [showGuide, setShowGuide] = React.useState(false);

  // Load shortlist from localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(TOWN.toLowerCase() + "_shortlist");
      if (saved) setShortlist(JSON.parse(saved));
    } catch(e) {}
  }, []);

  // Save shortlist
  React.useEffect(() => {
    localStorage.setItem(TOWN.toLowerCase() + "_shortlist", JSON.stringify(shortlist));
  }, [shortlist]);

  function toggleShortlist(id) {
    setShortlist(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  // Get unique types and areas
  const types = [...new Set(PROPERTIES.map(p => p.homeType).filter(Boolean))].sort();
  const areas = [...new Set(PROPERTIES.map(p => p.village).filter(Boolean))].sort();

  // Filter and sort
  const filtered = React.useMemo(() => {
    let list = PROPERTIES;
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p => (p.address || "").toLowerCase().includes(s));
    }
    if (typeFilter !== "all") list = list.filter(p => p.homeType === typeFilter);
    if (gradeFilter !== "all") list = list.filter(p => getGrade(p.investmentScore || 0) === gradeFilter);
    if (areaFilter !== "all") list = list.filter(p => p.village === areaFilter);

    list = [...list].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va == null) va = sortDir === "asc" ? Infinity : -Infinity;
      if (vb == null) vb = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof va === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return list;
  }, [search, typeFilter, gradeFilter, areaFilter, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const shortlistedProps = PROPERTIES.filter(p => shortlist.includes(p.id));

  if (phase === "rotate") {
    return React.createElement(RotatePrompt, { onContinue: () => setPhase("guide") });
  }

  if (phase === "guide") {
    return React.createElement(IntroGuide, { onClose: () => setPhase("app") });
  }

  const columns = [
    { key: "_star", label: "\u2606", sortable: false, width: "30px" },
    { key: "address", label: "Address" },
    { key: "homeType", label: "Type" },
    { key: "sqft", label: "Sqft" },
    { key: "assessedValue", label: "Assessed Value" },
    { key: "lotSize", label: "Lot Size" },
    { key: "yearBuilt", label: "Year Built" },
    { key: "village", label: "Village" },
    { key: "investmentScore", label: "Score" },
    { key: "_grade", label: "Grade", sortable: false }
  ];

  return React.createElement("div", { id: "app" },
    // Toolbar
    React.createElement("div", { className: "toolbar" },
      React.createElement("div", { className: "logo" },
        React.createElement("svg", { viewBox: "0 0 24 24" },
          React.createElement("path", { d: "M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z" })
        ),
        React.createElement("span", null, TOWN)
      ),
      React.createElement("div", { className: "search-wrap" },
        React.createElement("svg", { viewBox: "0 0 24 24" },
          React.createElement("path", { d: "M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1114 9.5 4.5 4.5 0 019.5 14z" })
        ),
        React.createElement("input", {
          type: "text",
          placeholder: "Search address...",
          value: search,
          onChange: e => setSearch(e.target.value)
        })
      ),
      React.createElement("div", { className: "filter-group" },
        React.createElement("select", { value: typeFilter, onChange: e => setTypeFilter(e.target.value) },
          React.createElement("option", { value: "all" }, "All Types"),
          types.map(t => React.createElement("option", { key: t, value: t }, t))
        ),
        React.createElement("select", { value: gradeFilter, onChange: e => setGradeFilter(e.target.value) },
          React.createElement("option", { value: "all" }, "All Grades"),
          ["A","B","C","D","F"].map(g => React.createElement("option", { key: g, value: g }, "Grade " + g))
        ),
        React.createElement("select", { value: areaFilter, onChange: e => setAreaFilter(e.target.value) },
          React.createElement("option", { value: "all" }, "All Areas"),
          areas.map(a => React.createElement("option", { key: a, value: a }, a))
        )
      ),
      React.createElement("button", {
        className: "shortlist-btn" + (showShortlist ? " active" : ""),
        onClick: () => setShowShortlist(!showShortlist)
      }, "\u2605 ", shortlist.length),
      React.createElement("button", {
        className: "compare-btn",
        disabled: shortlist.length < 2,
        onClick: () => setShowCompare(true)
      }, "Compare")
    ),

    // Stats bar
    React.createElement("div", { className: "stats-bar" },
      React.createElement("span", null, "Showing: ", React.createElement("span", { className: "accent" }, filtered.length), " of ", PROPERTIES.length, " properties"),
      React.createElement("span", null, "Shortlisted: ", React.createElement("span", { className: "accent" }, shortlist.length)),
      React.createElement("span", null, "Avg Score: ", React.createElement("span", { className: "accent" },
        filtered.length > 0 ? (filtered.reduce((s, p) => s + (p.investmentScore || 0), 0) / filtered.length).toFixed(1) : "0"
      ))
    ),

    // Table
    React.createElement("div", { className: "table-wrap" },
      React.createElement("table", null,
        React.createElement("thead", null,
          React.createElement("tr", null,
            columns.map(col =>
              React.createElement("th", {
                key: col.key,
                className: sortCol === col.key ? "sorted" : "",
                style: col.width ? { width: col.width } : undefined,
                onClick: col.sortable !== false ? () => handleSort(col.key) : undefined
              },
                col.label,
                col.sortable !== false && React.createElement("span", { className: "sort-icon" },
                  sortCol === col.key ? (sortDir === "asc" ? " \u25B2" : " \u25BC") : " \u25BC"
                )
              )
            )
          )
        ),
        React.createElement("tbody", null,
          filtered.map(p => {
            const grade = getGrade(p.investmentScore || 0);
            const isStarred = shortlist.includes(p.id);
            const scorePct = Math.min(100, ((p.investmentScore || 0) / 12) * 100);
            const barColor = grade === "A" ? "#4ADE80" : grade === "B" ? "#60A5FA" : grade === "C" ? "#FBBF24" : grade === "D" ? "#FB923C" : "#F87171";

            return React.createElement("tr", {
              key: p.id,
              onClick: () => setSelectedProp(p)
            },
              React.createElement("td", {
                className: "star-cell" + (isStarred ? " starred" : ""),
                onClick: e => { e.stopPropagation(); toggleShortlist(p.id); }
              },
                React.createElement("svg", { viewBox: "0 0 24 24" },
                  React.createElement("path", { d: "M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z" })
                )
              ),
              React.createElement("td", { style: { fontWeight: 500 } }, p.address),
              React.createElement("td", null, p.homeType || "N/A"),
              React.createElement("td", null, p.sqft ? fmtNum(p.sqft) : "N/A"),
              React.createElement("td", null, fmt(p.assessedValue)),
              React.createElement("td", null, p.lotSize ? p.lotSize + " ac" : "N/A"),
              React.createElement("td", null, p.yearBuilt || "N/A"),
              React.createElement("td", null, p.village || "N/A"),
              React.createElement("td", null,
                React.createElement("div", { className: "score-bar" },
                  React.createElement("span", null, p.investmentScore || 0),
                  React.createElement("div", { className: "bar" },
                    React.createElement("div", { className: "fill", style: { width: scorePct + "%", background: barColor } })
                  )
                )
              ),
              React.createElement("td", null,
                React.createElement("span", { className: "grade grade-" + grade }, grade)
              )
            );
          })
        )
      )
    ),

    // Property Modal
    selectedProp && React.createElement(PropertyModal, {
      property: selectedProp,
      onClose: () => setSelectedProp(null)
    }),

    // Compare Modal
    showCompare && shortlistedProps.length >= 2 && React.createElement(ComparePanel, {
      properties: shortlistedProps.slice(0, 3),
      onClose: () => setShowCompare(false)
    }),

    // Shortlist Panel
    React.createElement("div", { className: "shortlist-panel" + (showShortlist ? " open" : "") },
      React.createElement("div", { className: "panel-header" },
        React.createElement("h3", null, "Shortlist (" + shortlist.length + ")"),
        React.createElement("button", { onClick: () => setShowShortlist(false) }, "\u00D7")
      ),
      React.createElement("div", { className: "panel-body" },
        shortlistedProps.length === 0
          ? React.createElement("div", { className: "shortlist-empty" }, "Star properties to add them here")
          : shortlistedProps.map(p =>
            React.createElement("div", {
              key: p.id,
              className: "shortlist-item",
              onClick: () => { setSelectedProp(p); setShowShortlist(false); }
            },
              React.createElement("div", null,
                React.createElement("div", { className: "addr" }, p.address),
                React.createElement("div", { className: "meta" }, [p.homeType, fmt(p.assessedValue), "Score: " + (p.investmentScore || 0)].join(" | "))
              ),
              React.createElement("button", {
                className: "remove-btn",
                onClick: e => { e.stopPropagation(); toggleShortlist(p.id); }
              }, "\u00D7")
            )
          )
      )
    ),

    // Help button
    React.createElement("button", {
      className: "help-btn",
      onClick: () => setPhase("guide"),
      title: "Help"
    }, "?")
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
