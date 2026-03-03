/* Newton Investment Analyzer v2 */
var h = React.createElement;
var useState = React.useState;
var useEffect = React.useEffect;
var useMemo = React.useMemo;
var useRef = React.useRef;

var TOWN = "Newton";
var BG = "#1B2A4A";
var ACCENT = "#D4A843";

var PROPERTIES = window.__PROPERTIES__ || [];
var MARKET = window.__MARKET__ || {};
var MLS_ACTIVE = window.__MLS_ACTIVE__ || [];
var MLS_SOLDS = window.__MLS_SOLDS__ || [];
var MLS_RENTALS = window.__MLS_RENTALS__ || {};
var STATS = window.__STATS__ || {};

function getGrade(s) { return s >= 11 ? "A" : s >= 9 ? "B" : s >= 7 ? "C" : s >= 5 ? "D" : "F"; }
function fmt(n) { if (n == null || isNaN(n)) return "N/A"; return "$" + Number(n).toLocaleString("en-US", {maximumFractionDigits:0}); }
function fmtK(n) { if (n == null || isNaN(n)) return "N/A"; n = Number(n); if (Math.abs(n) >= 1e6) return "$" + (n/1e6).toFixed(1) + "M"; if (Math.abs(n) >= 1e3) return "$" + Math.round(n/1e3) + "K"; return "$" + n; }
function fmtPct(n) { if (n == null || isNaN(n)) return "N/A"; return Number(n).toFixed(1) + "%"; }
function fmtNum(n) { if (n == null || isNaN(n)) return "N/A"; return Number(n).toLocaleString("en-US"); }
function calcMortgage(principal, rate) { if (principal <= 0 || rate <= 0) return 0; var mr = rate / 12; return principal * (mr * Math.pow(1 + mr, 360)) / (Math.pow(1 + mr, 360) - 1); }

var medianPSF = MARKET.medianPSF || 400;
var avgRentPSF = MARKET.rentPerSqft || 1.5;
var STRAT_SHORT = {"Flip":"Flip","Hold":"Hold","BRRRR":"BRRRR","Value-Add":"V-Add"};
var STRAT_CLS = function(s) { return "strat-" + (s||"").toLowerCase().replace(/[^a-z]/g,""); };
var TYPE_LABEL = {"SF":"SF","MultiSmall":"Multi","Condo":"Condo","AptSmall":"Apt","MultiLarge":"Multi+","LD":"Land","MF":"Multi","CC":"Condo"};

var ALL_TYPES = [];
var ALL_AREAS = [];
(function() {
  var ts = {}, as = {};
  PROPERTIES.forEach(function(p) { if (p.homeType) ts[p.homeType] = 1; if (p.village) as[p.village] = 1; });
  ALL_TYPES = Object.keys(ts).sort();
  ALL_AREAS = Object.keys(as).sort();
})();

var PAGE_SIZE = 50;
var INIT_FILTERS = {
  search:"", strategies:[], grades:[], types:[],
  minScore:0, minTenure:0, minROI:0,
  priceMin:"", priceMax:"", sqftMin:"", sqftMax:"",
  area:"all", yearMin:"", yearMax:""
};

// ── Splash Screen ──
function SplashScreen(props) {
  var onContinue = props.onContinue;
  var s = useState(true), show = s[0], setShow = s[1];

  useEffect(function() {
    var check = function() {
      if (window.innerWidth > window.innerHeight) { setShow(false); onContinue(); }
    };
    window.addEventListener("resize", check);
    var orientCheck = function() { setTimeout(check, 200); };
    window.addEventListener("orientationchange", orientCheck);
    check();
    return function() {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", orientCheck);
    };
  }, []);

  if (!show) return null;

  return h("div", {className:"splash"},
    h("h1", null, TOWN),
    h("p", {className:"splash-sub"}, "Investment Analyzer"),
    h("div", {className:"splash-line"}),
    h("p", {className:"splash-brand"}, "Steinmetz Real Estate"),
    h("p", {className:"splash-brand2"}, "William Raveis"),
    h("div", {style:{height:"2rem"}}),
    h("div", {className:"splash-rotate"},
      h("svg", {viewBox:"0 0 80 56", width:80, height:56},
        h("rect", {x:8, y:4, width:24, height:38, rx:3, stroke:ACCENT, strokeWidth:1.5, fill:"none", opacity:0.35}),
        h("circle", {cx:20, cy:37, r:1.8, fill:ACCENT, opacity:0.35}),
        h("path", {d:"M34 18 C 42 8, 52 10, 54 18", stroke:ACCENT, strokeWidth:1.5, fill:"none", strokeLinecap:"round"}),
        h("path", {d:"M52 14 L54 18 L50 19", stroke:ACCENT, strokeWidth:1.5, fill:"none", strokeLinecap:"round", strokeLinejoin:"round"}),
        h("rect", {x:30, y:30, width:42, height:24, rx:3, stroke:ACCENT, strokeWidth:1.5, fill:"none", opacity:0.7}),
        h("circle", {cx:68, cy:42, r:1.8, fill:ACCENT, opacity:0.6}),
        h("line", {x1:36, y1:37, x2:60, y2:37, stroke:ACCENT, strokeWidth:0.8, opacity:0.3}),
        h("line", {x1:36, y1:41, x2:60, y2:41, stroke:ACCENT, strokeWidth:0.8, opacity:0.2}),
        h("line", {x1:36, y1:45, x2:60, y2:45, stroke:ACCENT, strokeWidth:0.8, opacity:0.2})
      )
    ),
    h("p", {className:"splash-hint"}, "Rotate to landscape for the best experience"),
    h("div", {style:{height:"1.5rem"}}),
    h("button", {className:"splash-btn", onClick:function(){setShow(false);onContinue();}}, "Continue in Portrait")
  );
}

// ── Intro Guide ──
var GUIDE_PAGES = [
  {title:"Welcome", text:TOWN+" Investment Analyzer helps you evaluate "+fmtNum(STATS.total||PROPERTIES.length)+" real estate investment opportunities. Browse properties, analyze deals with Flip, Hold, BRRRR, and Value-Add strategies, and build your shortlist."},
  {title:"Scoring System", text:"Properties scored 0\u201312 on value metrics: price efficiency vs market median, seller motivation (tenure), profit potential (ROI), and lead quality. Grades: A (11\u201312), B (9\u201310), C (7\u20138), D (5\u20136), F (0\u20134)."},
  {title:"How to Use", text:"Filter and sort properties in the table. Tap any row for detailed analysis with adjustable inputs. Star properties to build your shortlist, then send the list to Zev, download as CSV, or compare side by side."},
  {title:"Data Notes", text:"Property data from public assessor records. MLS data from MLS Property Information Network. Assessed values typically lag market value by 10-20%. ARV and renovation estimates are starting points \u2014 override them with your own numbers in the detail view. Always do your own due diligence."}
];

function IntroGuide(props) {
  var onClose = props.onClose;
  var s = useState(0), page = s[0], setPage = s[1];
  return h("div", {className:"guide-overlay"},
    h("div", {className:"guide-card"},
      h("button", {className:"close-btn", onClick:onClose}, "\u00D7"),
      h("h2", null, GUIDE_PAGES[page].title),
      h("p", null, GUIDE_PAGES[page].text),
      h("div", {className:"guide-nav"},
        h("button", {className:"secondary", style:{visibility:page===0?"hidden":"visible"}, onClick:function(){setPage(page-1);}}, "\u2190 Back"),
        h("div", {className:"guide-dots"},
          GUIDE_PAGES.map(function(_, i){ return h("span", {key:i, className:i===page?"active":""}); })
        ),
        h("button", {onClick:function(){page===GUIDE_PAGES.length-1?onClose():setPage(page+1);}}, page===GUIDE_PAGES.length-1?"Get Started \u2192":"Next \u2192")
      )
    )
  );
}

// ── Property Detail Modal ──
function PropertyModal(props) {
  var p = props.property, onClose = props.onClose, onToggleStar = props.onToggleStar, isStarred = props.isStarred;
  var ts = useState("flip"), tab = ts[0], setTab = ts[1];

  var initInputs = function() {
    return {
      purchasePrice: String(p.assessedValue || 0),
      renoBudget: String(p.estRenoBudget || Math.round((p.sqft || 0) * 85)),
      arv: String(p.estARV || Math.round((p.sqft || 0) * medianPSF * 1.2)),
      monthlyRent: String(p.estMonthlyRent || Math.round((p.sqft || 0) * avgRentPSF)),
      interestRate: String(((MARKET.mortgageRate || 0.06) * 100).toFixed(1)),
      downPayment: String(((MARKET.downPaymentPct || 0.25) * 100)),
      holdingMonths: String(p.strategy === "Flip" ? 6 : 12),
      commission: "4.0"
    };
  };

  var is = useState(initInputs), inputs = is[0], setInputs = is[1];

  function handleInput(f, v) {
    var o = {};
    for (var k in inputs) o[k] = inputs[k];
    o[f] = v;
    setInputs(o);
  }

  // Auto-recalculate results via useMemo
  var results = useMemo(function() {
    var pp = parseFloat(inputs.purchasePrice) || 0;
    var reno = parseFloat(inputs.renoBudget) || 0;
    var arv = parseFloat(inputs.arv) || 0;
    var rent = parseFloat(inputs.monthlyRent) || 0;
    var rate = (parseFloat(inputs.interestRate) || 6) / 100;
    var dp = (parseFloat(inputs.downPayment) || 25) / 100;
    var months = parseInt(inputs.holdingMonths) || 6;
    var commPct = (parseFloat(inputs.commission) || 4) / 100;
    var downAmt = pp * dp;
    var loanAmt = pp * (1 - dp);
    var mp = calcMortgage(loanAmt, rate);

    // Flip
    var fHold = mp * months;
    var fComm = pp * commPct;
    var fSell = arv * 0.05;
    var fTotal = pp + reno + fHold + fComm + fSell;
    var fProfit = arv - fTotal;
    var fCash = downAmt + reno + fComm;
    var fROI = fCash > 0 ? (fProfit / fCash) * 100 : 0;

    // Hold
    var hTax = (pp * (MARKET.taxRate || 0.012)) / 12;
    var hIns = (MARKET.insuranceAnnual || 2500) / 12;
    var hMaint = pp * (MARKET.maintenancePct || 0.01) / 12;
    var hVac = rent * (MARKET.vacancyRate || 0.05);
    var hCF = rent - mp - hTax - hIns - hMaint - hVac;
    var hAR = rent * 12;
    var hAE = (hTax + hIns + hMaint + hVac) * 12;
    var hNOI = hAR - hAE;
    var hCap = pp > 0 ? (hNOI / pp) * 100 : 0;
    var hYield = pp > 0 ? (hAR / pp) * 100 : 0;
    var hACF = hCF * 12;
    var hCoC = downAmt > 0 ? (hACF / downAmt) * 100 : 0;

    // BRRRR
    var bCC = pp * 0.03;
    var bCashIn = downAmt + reno + bCC;
    var bRefi = arv * 0.75;
    var bCashLeft = bCashIn - bRefi;
    var bRPmt = calcMortgage(bRefi, rate);
    var bTax = (arv * (MARKET.taxRate || 0.012)) / 12;
    var bIns = (arv * 0.005) / 12;
    var bCF = rent - bRPmt - bTax - bIns - (rent * 0.15);

    // Value-Add
    var vApp = arv - pp;
    var vEq = vApp - reno;
    var vPct = pp > 0 ? (vApp / pp) * 100 : 0;
    var vROI = reno > 0 ? (vApp / reno) * 100 : 0;

    return {
      flip: [
        {l:"Purchase Price",v:fmt(pp)},{l:"Reno Budget",v:fmt(reno)},{l:"Holding Cost",v:fmt(fHold)},
        {l:"Purchase Comm.",v:fmt(fComm)},{l:"Selling Cost (5%)",v:fmt(fSell)},{l:"Total Cost",v:fmt(fTotal)},
        {l:"ARV",v:fmt(arv)},{l:"Profit",v:fmt(fProfit),p:fProfit>=0},{l:"Cash Invested",v:fmt(fCash)},{l:"ROI",v:fmtPct(fROI),p:fROI>=0}
      ],
      hold: [
        {l:"Monthly Rent",v:fmt(rent)},{l:"Mortgage",v:fmt(mp)},{l:"Tax (monthly)",v:fmt(hTax)},
        {l:"Insurance",v:fmt(hIns)},{l:"Maintenance",v:fmt(hMaint)},{l:"Vacancy (5%)",v:fmt(hVac)},
        {l:"Monthly Cash Flow",v:fmt(hCF),p:hCF>=0},{l:"NOI",v:fmt(hNOI),p:hNOI>=0},
        {l:"Cap Rate",v:fmtPct(hCap)},{l:"Gross Yield",v:fmtPct(hYield)},{l:"Cash-on-Cash",v:fmtPct(hCoC),p:hCoC>=0}
      ],
      brrrr: [
        {l:"Down Payment",v:fmt(downAmt)},{l:"Reno Budget",v:fmt(reno)},{l:"Closing Costs",v:fmt(bCC)},
        {l:"Total Cash In",v:fmt(bCashIn)},{l:"Refi @ 75% ARV",v:fmt(bRefi)},{l:"Cash Left in Deal",v:fmt(bCashLeft),p:bCashLeft<=0},
        {l:"Refi Payment",v:fmt(bRPmt)},{l:"Post-Refi Cash Flow",v:fmt(bCF),p:bCF>=0}
      ],
      valueadd: [
        {l:"Before Value",v:fmt(pp)},{l:"After Value (ARV)",v:fmt(arv)},
        {l:"Forced Appreciation",v:fmt(vApp),p:vApp>=0},{l:"Reno Cost",v:fmt(reno)},
        {l:"Equity Created",v:fmt(vEq),p:vEq>=0},{l:"Appreciation %",v:fmtPct(vPct)},{l:"ROI on Reno",v:fmtPct(vROI)}
      ]
    };
  }, [inputs]);

  var grade = getGrade(p.investmentScore || 0);
  var tabLabels = {flip:"Flip Analysis",hold:"Hold Analysis",brrrr:"BRRRR Analysis",valueadd:"Value-Add Analysis"};
  var tabShort = {flip:"Flip",hold:"Hold",brrrr:"BRRRR",valueadd:"Value-Add"};
  var inputFields = [
    {key:"purchasePrice",label:"Purchase Price ($)"},{key:"renoBudget",label:"Reno Budget ($)"},
    {key:"arv",label:"ARV ($)"},{key:"monthlyRent",label:"Monthly Rent ($)"},
    {key:"interestRate",label:"Interest Rate (%)"},{key:"downPayment",label:"Down Payment (%)"},
    {key:"holdingMonths",label:"Holding Months"},{key:"commission",label:"Commission (%)"}
  ];

  return h("div", {className:"modal-overlay", onClick:function(e){if(e.target===e.currentTarget)onClose();}},
    h("div", {className:"modal", onClick:function(e){e.stopPropagation();}},
      h("div", {className:"modal-header"},
        h("div", {className:"prop-info"},
          h("h2", null, p.address),
          h("p", null, (p.village||TOWN) + (p.zip?", "+p.zip:"") + " \u00B7 " + (TYPE_LABEL[p.homeType]||p.homeType||"N/A") + (p.owner?" \u00B7 "+p.owner:"")),
          h("div", {className:"modal-badges"},
            h("span", {className:"strat-badge "+STRAT_CLS(p.strategy)}, STRAT_SHORT[p.strategy]||p.strategy),
            h("span", {className:"grade grade-"+grade}, "Score: "+(p.investmentScore||0)+" ("+grade+")"),
            p.tenure > 0 && h("span", {className:"modal-tenure"}, "Tenure: "+p.tenure+"yr")
          )
        ),
        h("div", {className:"modal-actions"},
          h("button", {
            className:"star-modal-btn"+(isStarred?" starred":""),
            onClick:function(){onToggleStar(p.id);}
          }, isStarred?"\u2605 Starred":"\u2606 Star"),
          h("button", {className:"close-modal", onClick:onClose}, "\u00D7")
        )
      ),
      p.mlsListNo && h("img", {
        className:"modal-photo",
        src:"https://media.mlspin.com/photo.aspx?mls="+p.mlsListNo+"&n=0&w=900&h=500",
        alt:p.address, onError:function(e){e.target.style.display="none";}
      }),
      h("div", {className:"strategy-tabs"},
        ["flip","hold","brrrr","valueadd"].map(function(t){ return h("button", {key:t, className:tab===t?"active":"", onClick:function(){setTab(t);}}, tabShort[t]); })
      ),
      h("div", {className:"modal-body"},
        h("div", {className:"inputs-grid"},
          inputFields.map(function(f) {
            return h("div", {key:f.key, className:"input-group"},
              h("label", null, f.label),
              h("input", {type:"text", inputMode:"decimal", value:inputs[f.key], onChange:function(e){handleInput(f.key, e.target.value);}})
            );
          })
        ),
        h("button", {className:"recalc-btn", onClick:function(){setInputs(initInputs());}}, "Reset to Defaults"),
        h("div", {className:"results-section"},
          h("h3", null, tabLabels[tab]),
          h("div", {className:"results-grid"},
            (results[tab]||[]).map(function(c, i) {
              return h("div", {key:i, className:"result-card"},
                h("div", {className:"label"}, c.l),
                h("div", {className:"value"+(c.p===true?" positive":c.p===false?" negative":"")}, c.v)
              );
            })
          )
        )
      )
    )
  );
}

// ── Compare Panel ──
function ComparePanel(props) {
  var properties = props.properties, onClose = props.onClose;
  var metrics = [
    {l:"Address",fn:function(p){return p.address;}},{l:"Type",fn:function(p){return TYPE_LABEL[p.homeType]||p.homeType||"N/A";}},
    {l:"Area",fn:function(p){return p.village||"N/A";}},{l:"Assessed Value",fn:function(p){return fmt(p.assessedValue);}},
    {l:"Sqft",fn:function(p){return fmtNum(p.sqft);}},{l:"$/Sqft",fn:function(p){return fmt(p.pricePerSqft);}},
    {l:"Score",fn:function(p){return (p.investmentScore||0)+"/12";}},{l:"Grade",fn:function(p){return getGrade(p.investmentScore||0);}},
    {l:"Strategy",fn:function(p){return p.strategy||"N/A";}},{l:"Est. ARV",fn:function(p){return fmt(p.estARV);}},
    {l:"Est. Profit",fn:function(p){return fmt(p.estProfit);}},{l:"Est. ROI",fn:function(p){return p.estROI?fmtPct(p.estROI):"N/A";}},
    {l:"Monthly Rent",fn:function(p){return fmt(p.estMonthlyRent);}},{l:"Gross Yield",fn:function(p){return p.estGrossYield?fmtPct(p.estGrossYield):"N/A";}},
    {l:"BRRRR Cash Left",fn:function(p){return p.brrrr_cashLeft!=null?fmt(p.brrrr_cashLeft):"N/A";}},
    {l:"Tenure",fn:function(p){return (p.tenure||0)+" yrs";}}
  ];
  return h("div", {className:"compare-overlay", onClick:function(e){if(e.target===e.currentTarget)onClose();}},
    h("div", {className:"compare-panel"},
      h("button", {className:"close-modal", onClick:onClose}, "\u00D7"),
      h("h2", null, "Compare Properties ("+properties.length+")"),
      h("table", {className:"compare-table"},
        h("thead", null, h("tr", null,
          h("th", null, "Metric"),
          properties.map(function(p,i){ return h("th", {key:i}, p.address.substring(0,20)); })
        )),
        h("tbody", null, metrics.map(function(m,i) {
          return h("tr", {key:i},
            h("td", {style:{color:"var(--accent)",fontWeight:600}}, m.l),
            properties.map(function(p,j){ return h("td", {key:j}, m.fn(p)); })
          );
        }))
      )
    )
  );
}

// ── Dashboard Cards ──
function DashboardCards() {
  var cards = [
    {l:"Properties",v:fmtNum(STATS.total||PROPERTIES.length),s:TOWN+", MA"},
    {l:"Median Sale Price",v:fmt(MARKET.medianSalePrice),s:"MLS sold data"},
    {l:"Median $/sqft",v:"$"+(MARKET.medianPSF||"N/A"),s:(MARKET.totalSolds||0)+" sales"},
    {l:"Active Listings",v:fmtNum(MARKET.totalActive||0),s:Object.entries(MARKET.activeByType||{}).map(function(e){return e[1]+" "+e[0];}).join(" \u00B7 ")},
    {l:"Mortgage Rate",v:((MARKET.mortgageRate||0.06)*100).toFixed(1)+"%",s:"30yr fixed"},
    {l:"Median Rent",v:MARKET.medianRent?fmt(MARKET.medianRent):"N/A",s:MLS_RENTALS.total?MLS_RENTALS.total+" listings":"limited data"}
  ];
  return h("div", {className:"dash-cards"},
    cards.map(function(c,i){
      return h("div", {key:i, className:"dash-card"},
        h("div", {className:"dc-label"}, c.l),
        h("div", {className:"dc-value"}, c.v),
        c.s && h("div", {className:"dc-sub"}, c.s)
      );
    })
  );
}

// ── Filter Bar ──
function FilterBar(props) {
  var filters=props.filters, onChange=props.onChange, count=props.count, total=props.total;
  var sm=useState(false), showMore=sm[0], setShowMore=sm[1];

  function toggle(field,val) {
    var next={};for(var k in filters)next[k]=filters[k];
    var arr=next[field].slice();
    var idx=arr.indexOf(val);
    if(idx>=0)arr.splice(idx,1);else arr.push(val);
    next[field]=arr;onChange(next);
  }
  function set(field,val){var next={};for(var k in filters)next[k]=filters[k];next[field]=val;onChange(next);}
  function reset(){var r={};for(var k in INIT_FILTERS)r[k]=Array.isArray(INIT_FILTERS[k])?[]:INIT_FILTERS[k];onChange(r);setShowMore(false);}

  function chip(key, label, active, onClick) {
    return h("button", {key:key, className:"chip"+(active?" chip-on":""), onClick:onClick}, label);
  }

  return h("div", {className:"filter-bar"},
    h("div", {className:"fb-row"},
      h("div", {className:"fb-search"},
        h("svg", {viewBox:"0 0 24 24", width:14, height:14},
          h("path", {fill:"var(--text-muted)", d:"M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1114 9.5 4.5 4.5 0 019.5 14z"})
        ),
        h("input", {type:"text", placeholder:"Search address, owner, area\u2026", value:filters.search, onChange:function(e){set("search",e.target.value);}})
      ),
      h("span", {className:"fb-count"}, count+" of "+total)
    ),
    h("div", {className:"fb-row fb-chips"},
      ["Flip","Hold","BRRRR","Value-Add"].map(function(s){ return chip("s-"+s, STRAT_SHORT[s]||s, filters.strategies.indexOf(s)>=0, function(){toggle("strategies",s);}); }),
      h("span", {className:"fb-sep"}),
      ["A","B","C","D","F"].map(function(g){ return chip("g-"+g, g, filters.grades.indexOf(g)>=0, function(){toggle("grades",g);}); }),
      h("button", {key:"more", className:"chip chip-action", onClick:function(){setShowMore(!showMore);}}, showMore?"Less \u25B2":"More \u25BC"),
      h("button", {key:"reset", className:"chip chip-reset", onClick:reset}, "Reset")
    ),
    showMore && h("div", {className:"fb-more"},
      h("div", {className:"fb-sliders"},
        h("div", {className:"fb-slider"},
          h("label", null, "Min Score: "+filters.minScore),
          h("input", {type:"range", min:0, max:12, step:1, value:filters.minScore, onChange:function(e){set("minScore",parseInt(e.target.value));}})
        ),
        h("div", {className:"fb-slider"},
          h("label", null, "Min Tenure: "+filters.minTenure+"yr"),
          h("input", {type:"range", min:0, max:125, step:5, value:filters.minTenure, onChange:function(e){set("minTenure",parseInt(e.target.value));}})
        ),
        h("div", {className:"fb-slider"},
          h("label", null, "Min ROI: "+filters.minROI+"%"),
          h("input", {type:"range", min:0, max:100, step:5, value:filters.minROI, onChange:function(e){set("minROI",parseInt(e.target.value));}})
        )
      ),
      h("div", {className:"fb-ranges"},
        h("div", {className:"fb-range"},
          h("label", null, "Price"),
          h("input", {type:"number", placeholder:"Min", value:filters.priceMin, onChange:function(e){set("priceMin",e.target.value);}}),
          h("span", null, "\u2013"),
          h("input", {type:"number", placeholder:"Max", value:filters.priceMax, onChange:function(e){set("priceMax",e.target.value);}})
        ),
        h("div", {className:"fb-range"},
          h("label", null, "Sqft"),
          h("input", {type:"number", placeholder:"Min", value:filters.sqftMin, onChange:function(e){set("sqftMin",e.target.value);}}),
          h("span", null, "\u2013"),
          h("input", {type:"number", placeholder:"Max", value:filters.sqftMax, onChange:function(e){set("sqftMax",e.target.value);}})
        )
      ),
      h("div", {className:"fb-row fb-chips"},
        ALL_TYPES.map(function(t){ return chip("t-"+t, TYPE_LABEL[t]||t, filters.types.indexOf(t)>=0, function(){toggle("types",t);}); }),
        h("select", {key:"area-select", className:"fb-select", value:filters.area, onChange:function(e){set("area",e.target.value);}},
          h("option", {value:"all"}, "All Areas"),
          ALL_AREAS.map(function(a){ return h("option", {key:a, value:a}, a); })
        )
      ),
      h("div", {className:"fb-ranges"},
        h("div", {className:"fb-range"},
          h("label", null, "Year Built"),
          h("input", {type:"number", placeholder:"Min", value:filters.yearMin, onChange:function(e){set("yearMin",e.target.value);}}),
          h("span", null, "\u2013"),
          h("input", {type:"number", placeholder:"Max", value:filters.yearMax, onChange:function(e){set("yearMax",e.target.value);}})
        )
      )
    )
  );
}

// ── MLS Type Badge ──
function typeBadge(t) {
  var cls = t==="SF"?"mls-badge-sf":t==="MF"?"mls-badge-mf":t==="CC"?"mls-badge-cc":"mls-badge-ld";
  return h("span", {className:"mls-badge "+cls}, t);
}

// ── MLS to Property converters ──
function mlsActiveToProperty(lst) {
  var sqft = lst.sqft || 0;
  var price = lst.price || 0;
  var tm = {"SF":"SF","MF":"MultiSmall","CC":"Condo","LD":"LD"};
  return {
    id:"mls-"+lst.list_no, address:lst.address+(lst.unit?" #"+lst.unit:""), village:lst.area||TOWN,
    zip:"", owner:"", homeType:tm[lst.type]||lst.type, assessedValue:price, sqft:sqft,
    pricePerSqft:sqft>0?Math.round(price/sqft):0, tenure:0, leadScore:0, leadGrade:"C",
    segment:"Active MLS Listing", strategy:"Flip", investmentScore:0,
    estARV:Math.round(sqft>0?sqft*medianPSF*1.15:price*1.15),
    estRenoBudget:Math.round(sqft*85), estProfit:0, estROI:0,
    estMonthlyRent:Math.round(sqft*avgRentPSF), estAnnualRent:Math.round(sqft*avgRentPSF*12),
    estGrossYield:0, estMonthlyCashflow:0, marketPSF:medianPSF, mlsListNo:lst.list_no
  };
}

function mlsSoldToProperty(s) {
  var sqft = s.sqft || 0;
  var price = s.sale_price || 0;
  var tm = {"SF":"SF","MF":"MultiSmall","CC":"Condo","LD":"LD"};
  return {
    id:"sold-"+s.list_no, address:s.address+(s.unit?" #"+s.unit:""), village:s.area||TOWN,
    zip:"", owner:"", homeType:tm[s.type]||s.type, assessedValue:price, sqft:sqft,
    pricePerSqft:s.psf||(sqft>0?Math.round(price/sqft):0), tenure:0, leadScore:0, leadGrade:"C",
    segment:"Recent Sale"+(s.sale_date?" ("+s.sale_date+")":""), strategy:"Flip", investmentScore:0,
    estARV:Math.round(sqft>0?sqft*medianPSF*1.15:price*1.15),
    estRenoBudget:Math.round(sqft*85), estProfit:0, estROI:0,
    estMonthlyRent:Math.round(sqft*avgRentPSF), estAnnualRent:Math.round(sqft*avgRentPSF*12),
    estGrossYield:0, estMonthlyCashflow:0, marketPSF:medianPSF, mlsListNo:s.list_no
  };
}

// ── Active Listings Section ──
function ActiveSection(props) {
  var onSelect = props.onSelect;
  if (MLS_ACTIVE.length === 0) return h("div", {className:"section-empty"}, "Active MLS listings coming soon");
  return h("div", {className:"section-content"},
    h("div", {className:"mls-grid"},
      MLS_ACTIVE.slice(0,30).map(function(lst,i) {
        return h("div", {key:i, className:"mls-card", onClick:function(){onSelect(mlsActiveToProperty(lst));}},
          lst.photo_count > 0
            ? h("img", {src:"https://media.mlspin.com/photo.aspx?mls="+lst.list_no+"&n=0&w=600&h=450", alt:lst.address, loading:"lazy", onError:function(e){e.target.style.display="none";}})
            : h("div", {className:"mls-nophoto"}, "No Photo"),
          h("div", {className:"mls-info"},
            h("div", {className:"mls-addr"}, lst.address, lst.unit?" #"+lst.unit:"", " ", typeBadge(lst.type)),
            h("div", {className:"mls-price"}, fmt(lst.price)),
            h("div", {className:"mls-meta"},
              [lst.beds?lst.beds+"BR":null, lst.sqft?fmtNum(lst.sqft)+" sqft":null, lst.sqft&&lst.price?"$"+Math.round(lst.price/lst.sqft)+"/sqft":null].filter(Boolean).join(" \u00B7 ")||"MLS #"+lst.list_no
            )
          )
        );
      })
    )
  );
}

// ── Recent Sales Section ──
function SalesSection(props) {
  var onSelect = props.onSelect;
  if (MLS_SOLDS.length === 0) return h("div", {className:"section-empty"}, "Recent sales data coming soon");
  return h("div", {className:"section-content"},
    h("table", {className:"mls-sold-table"},
      h("thead", null, h("tr", null,
        h("th", null, "Address"), h("th", null, "Type"), h("th", null, "Sale Price"), h("th", null, "Date"), h("th", {className:"col-wide"}, "Sqft"), h("th", {className:"col-wide"}, "$/Sqft")
      )),
      h("tbody", null, MLS_SOLDS.map(function(s,i) {
        return h("tr", {key:i, style:{cursor:"pointer"}, onClick:function(){onSelect(mlsSoldToProperty(s));}},
          h("td", {style:{fontWeight:500}}, s.address),
          h("td", null, typeBadge(s.type)),
          h("td", {style:{color:"var(--accent)",fontWeight:600}}, fmt(s.sale_price)),
          h("td", null, s.sale_date||"N/A"),
          h("td", {className:"col-wide"}, s.sqft?fmtNum(s.sqft):"N/A"),
          h("td", {className:"col-wide"}, s.psf?"$"+s.psf:"N/A")
        );
      }))
    )
  );
}

// ── Rental Snapshot Section ──
function RentalsSection() {
  var r = MLS_RENTALS;
  if (!r || !r.medianRent) return h("div", {className:"section-empty"}, "Limited rental data for this market");
  var beds = r.byBedrooms || {};
  var statCards = [
    {l:"Total Listings",v:r.total||0,s:"active rentals"},
    {l:"Median Rent",v:fmt(r.medianRent),s:"all sizes"},
    {l:"Rent Range",v:r.rentRange?fmt(r.rentRange[0])+" \u2013 "+fmt(r.rentRange[1]):"N/A",s:"min to max"}
  ];
  if (r.rentPerSqft) statCards.push({l:"Rent/Sqft",v:"$"+r.rentPerSqft,s:"per month"});
  Object.keys(beds).forEach(function(b) {
    statCards.push({l:b+"BR",v:fmt(beds[b]),s:"median asking"});
  });
  return h("div", {className:"section-content"},
    h("div", {className:"rent-stats"},
      statCards.map(function(c,i) {
        return h("div", {key:i, className:"rent-stat"},
          h("div", {className:"rs-label"}, c.l),
          h("div", {className:"rs-value"}, c.v),
          h("div", {className:"rs-sub"}, c.s)
        );
      })
    )
  );
}

// ── Main App ──
function App() {
  var ps = useState("splash"), phase = ps[0], setPhase = ps[1];
  var ss = useState("properties"), section = ss[0], setSection = ss[1];
  var fs = useState(function(){var r={};for(var k in INIT_FILTERS)r[k]=Array.isArray(INIT_FILTERS[k])?[]:INIT_FILTERS[k];return r;}), filters = fs[0], setFilters = fs[1];
  var sc = useState("investmentScore"), sortCol = sc[0], setSortCol = sc[1];
  var sd = useState("desc"), sortDir = sd[0], setSortDir = sd[1];
  var sp = useState(null), selectedProp = sp[0], setSelectedProp = sp[1];
  var sl = useState([]), shortlist = sl[0], setShortlist = sl[1];
  var cmp = useState(false), showCompare = cmp[0], setShowCompare = cmp[1];
  var pg = useState(0), page = pg[0], setPage = pg[1];
  var sg = useState(false), showGuide = sg[0], setShowGuide = sg[1];
  var scrollRef = useRef(null);

  // Load shortlist from localStorage
  useEffect(function() {
    try { var s = localStorage.getItem(TOWN.toLowerCase()+"_shortlist"); if (s) setShortlist(JSON.parse(s)); } catch(e) {}
  }, []);
  useEffect(function() {
    localStorage.setItem(TOWN.toLowerCase()+"_shortlist", JSON.stringify(shortlist));
  }, [shortlist]);

  // Lock body scroll when modal open
  useEffect(function() {
    document.body.style.overflow = selectedProp ? "hidden" : "";
    return function() { document.body.style.overflow = ""; };
  }, [selectedProp]);

  function toggleShortlist(id) {
    setShortlist(function(prev) { return prev.indexOf(id) >= 0 ? prev.filter(function(x){return x!==id;}) : prev.concat([id]); });
  }

  // Filter + sort
  var filtered = useMemo(function() {
    var list = PROPERTIES;
    if (filters.search) {
      var s = filters.search.toLowerCase();
      list = list.filter(function(p) {
        return (p.address||"").toLowerCase().indexOf(s)>=0 || (p.owner||"").toLowerCase().indexOf(s)>=0 ||
               (p.village||"").toLowerCase().indexOf(s)>=0 || (p.segment||"").toLowerCase().indexOf(s)>=0;
      });
    }
    if (filters.strategies.length > 0) list = list.filter(function(p){return filters.strategies.indexOf(p.strategy)>=0;});
    if (filters.grades.length > 0) list = list.filter(function(p){return filters.grades.indexOf(getGrade(p.investmentScore||0))>=0;});
    if (filters.types.length > 0) list = list.filter(function(p){return filters.types.indexOf(p.homeType)>=0;});
    if (filters.minScore > 0) list = list.filter(function(p){return (p.investmentScore||0)>=filters.minScore;});
    if (filters.minTenure > 0) list = list.filter(function(p){return (p.tenure||0)>=filters.minTenure;});
    if (filters.minROI > 0) list = list.filter(function(p){return (p.estROI||0)>=filters.minROI;});
    if (filters.priceMin) list = list.filter(function(p){return (p.assessedValue||0)>=parseFloat(filters.priceMin);});
    if (filters.priceMax) list = list.filter(function(p){return (p.assessedValue||0)<=parseFloat(filters.priceMax);});
    if (filters.sqftMin) list = list.filter(function(p){return (p.sqft||0)>=parseFloat(filters.sqftMin);});
    if (filters.sqftMax) list = list.filter(function(p){return (p.sqft||0)<=parseFloat(filters.sqftMax);});
    if (filters.area !== "all") list = list.filter(function(p){return p.village===filters.area;});
    if (filters.yearMin) list = list.filter(function(p){return p.yearBuilt && p.yearBuilt>=parseInt(filters.yearMin);});
    if (filters.yearMax) list = list.filter(function(p){return p.yearBuilt && p.yearBuilt<=parseInt(filters.yearMax);});

    list = list.slice().sort(function(a,b) {
      var va=a[sortCol], vb=b[sortCol];
      if (va==null) va=sortDir==="asc"?Infinity:-Infinity;
      if (vb==null) vb=sortDir==="asc"?Infinity:-Infinity;
      if (typeof va==="string") return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);
      return sortDir==="asc"?va-vb:vb-va;
    });
    return list;
  }, [filters, sortCol, sortDir]);

  var totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  var paged = useMemo(function() {
    return filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filtered, page]);

  // Reset page when filters change
  useEffect(function() { setPage(0); }, [filters, sortCol, sortDir]);

  function handleSort(col) {
    if (sortCol === col) { setSortDir(function(d){return d==="asc"?"desc":"asc";}); }
    else { setSortCol(col); setSortDir("desc"); }
  }

  var shortlistedProps = PROPERTIES.filter(function(p){return shortlist.indexOf(p.id)>=0;});

  // Shortlist actions
  function buildListText(props) {
    var txt = TOWN+" MA \u2014 Property Shortlist ("+props.length+" properties)\n";
    txt += "Sent from "+TOWN+" Investment Analyzer on "+new Date().toLocaleDateString()+"\n\n";
    props.forEach(function(p, i) {
      txt += (i+1)+". "+p.address+", "+p.village+" MA "+p.zip+"\n";
      txt += "   Owner: "+p.owner+" | Type: "+p.homeType+" | Strategy: "+p.strategy+"\n";
      txt += "   Assessed: "+fmt(p.assessedValue)+" | "+fmtNum(p.sqft)+" sqft | $/sqft: "+fmt(p.pricePerSqft)+"\n";
      txt += "   Score: "+(p.investmentScore||0)+"/12 | Grade: "+(p.leadGrade||getGrade(p.investmentScore||0))+" | Tenure: "+p.tenure+" yrs\n";
      txt += "   Est ARV: "+fmt(p.estARV)+" | Reno: "+fmt(p.estRenoBudget)+" | Profit: "+fmt(p.estProfit)+" | ROI: "+fmtPct(p.estROI)+"\n";
      if (p.estMonthlyRent) txt += "   Rent: "+fmt(p.estMonthlyRent)+"/mo | Yield: "+fmtPct(p.estGrossYield)+"\n";
      txt += "\n";
    });
    return txt;
  }

  function sendListToZev() {
    if (shortlistedProps.length === 0) return;
    var subject = encodeURIComponent(TOWN+" Investment Shortlist \u2014 "+shortlistedProps.length+" Properties");
    var bodyText = buildListText(shortlistedProps);
    var body = encodeURIComponent(bodyText);
    var mailtoUrl = "mailto:zev.steinmetz@raveis.com?subject="+subject+"&body="+body;
    if (mailtoUrl.length > 2000) {
      if (navigator.clipboard) navigator.clipboard.writeText(bodyText);
      var shortBody = encodeURIComponent(TOWN+" Investment Shortlist \u2014 "+shortlistedProps.length+" properties\n\nFull list copied to clipboard. Please paste below.\n\nProperties: "+shortlistedProps.map(function(p){return p.address;}).join(", "));
      window.open("mailto:zev.steinmetz@raveis.com?subject="+subject+"&body="+shortBody, "_self");
    } else {
      window.open(mailtoUrl, "_self");
    }
  }

  function downloadCSV() {
    if (shortlistedProps.length === 0) return;
    var headers = ["Address","Village","ZIP","Owner","Type","Assessed Value","Sqft","$/Sqft","Tenure","Lead Score","Grade","Strategy","Inv Score","Est ARV","Reno Budget","Est Profit","ROI%","Monthly Rent","Gross Yield%","Segment"];
    var rows = shortlistedProps.map(function(p) {
      return [p.address,p.village,p.zip,p.owner,p.homeType,p.assessedValue,p.sqft,p.pricePerSqft,p.tenure,p.leadScore,p.leadGrade,p.strategy,p.investmentScore,p.estARV,p.estRenoBudget,p.estProfit,p.estROI,p.estMonthlyRent,p.estGrossYield,p.segment];
    });
    var csv = headers.join(",") + "\n";
    rows.forEach(function(r) {
      csv += r.map(function(v){ return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'; }).join(",") + "\n";
    });
    var blob = new Blob([csv], {type:"text/csv"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = TOWN+"_Shortlist_"+new Date().toISOString().slice(0,10)+".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearShortlist() { setShortlist([]); }

  // Phase rendering
  if (phase === "splash") return h(SplashScreen, {onContinue:function(){setPhase("guide");}});
  if (phase === "guide") return h(IntroGuide, {onClose:function(){setPhase("app");}});

  var columns = [
    {key:"_star", label:"\u2606", sort:false, cls:""},
    {key:"address", label:"Address", cls:""},
    {key:"homeType", label:"Type", cls:"col-med"},
    {key:"assessedValue", label:"Value", cls:""},
    {key:"sqft", label:"Sqft", cls:"col-wide"},
    {key:"yearBuilt", label:"Year", cls:"col-wide"},
    {key:"village", label:"Area", cls:"col-wide"},
    {key:"investmentScore", label:"Score", cls:""},
    {key:"_grade", label:"Grd", cls:""},
    {key:"strategy", label:"Strat", cls:"col-med"},
    {key:"estROI", label:"ROI", cls:"col-med"},
    {key:"estProfit", label:"Profit", cls:""}
  ];

  var SECTIONS = [
    {key:"properties", label:"Properties"},
    {key:"active", label:"Active ("+MLS_ACTIVE.length+")"},
    {key:"sales", label:"Sales ("+MLS_SOLDS.length+")"},
    {key:"rentals", label:"Rentals"}
  ];

  // Pagination
  function renderPagination() {
    if (filtered.length <= PAGE_SIZE) return null;
    var pageNums = [];
    var startPg = Math.max(0, Math.min(page - 2, totalPages - 5));
    var endPg = Math.min(totalPages, startPg + 5);
    for (var i = startPg; i < endPg; i++) pageNums.push(i);

    return h("div", {className:"pagination"},
      h("span", {className:"pg-info"}, (page*PAGE_SIZE+1)+"\u2013"+Math.min((page+1)*PAGE_SIZE,filtered.length)+" of "+fmtNum(filtered.length)),
      h("div", {className:"pg-buttons"},
        h("button", {disabled:page===0, onClick:function(){setPage(page-1);}}, "Prev"),
        pageNums.map(function(pg) {
          return h("button", {key:pg, className:page===pg?"pg-active":"", onClick:function(){setPage(pg);}}, pg+1);
        }),
        h("button", {disabled:page>=totalPages-1, onClick:function(){setPage(page+1);}}, "Next")
      )
    );
  }

  // Shortlist bar
  function renderShortlistBar() {
    if (shortlist.length === 0) return null;
    return h("div", {className:"shortlist-bar"},
      h("div", {className:"sl-header"},
        h("span", {className:"sl-title"}, "\u2605 Your Shortlist ("+shortlist.length+")"),
        h("div", {className:"sl-actions"},
          h("button", {className:"sl-btn sl-primary", onClick:sendListToZev}, "\u2709 Send to Zev"),
          h("button", {className:"sl-btn sl-secondary", onClick:downloadCSV}, "\u21E9 CSV"),
          shortlist.length >= 2 && shortlist.length <= 4 && h("button", {className:"sl-btn sl-secondary", onClick:function(){setShowCompare(true);}}, "Compare"),
          h("button", {className:"sl-btn sl-danger", onClick:clearShortlist}, "Clear")
        )
      ),
      h("div", {className:"sl-chips"},
        shortlistedProps.map(function(p) {
          return h("span", {key:p.id, className:"sl-chip"},
            h("span", {className:"strat-dot "+STRAT_CLS(p.strategy)}),
            h("span", {className:"sl-chip-addr"}, p.address),
            h("span", {className:"sl-chip-score"}, (p.investmentScore||0)),
            h("button", {onClick:function(e){e.stopPropagation();toggleShortlist(p.id);}}, "\u00D7")
          );
        })
      )
    );
  }

  function renderSection() {
    if (section === "active") return h(ActiveSection, {onSelect:setSelectedProp});
    if (section === "sales") return h(SalesSection, {onSelect:setSelectedProp});
    if (section === "rentals") return h(RentalsSection);

    // Properties section
    return h("div", null,
      h(DashboardCards),
      h(FilterBar, {filters:filters, onChange:setFilters, count:filtered.length, total:PROPERTIES.length}),
      renderShortlistBar(),
      h("div", {className:"stats-bar"},
        h("span", null, "Showing: ", h("span", {className:"accent"}, fmtNum(filtered.length)), " of ", fmtNum(PROPERTIES.length)),
        h("span", null, "Starred: ", h("span", {className:"accent"}, shortlist.length)),
        h("span", null, "Avg Score: ", h("span", {className:"accent"}, filtered.length>0?(filtered.reduce(function(s,p){return s+(p.investmentScore||0);},0)/filtered.length).toFixed(1):"0"))
      ),
      h("div", {className:"table-wrap"},
        h("table", null,
          h("thead", null,
            h("tr", null,
              columns.map(function(col) {
                return h("th", {
                  key:col.key,
                  className:(sortCol===col.key?"sorted":"")+(col.cls?" "+col.cls:""),
                  onClick:col.sort!==false?function(){handleSort(col.key);}:undefined
                }, col.label, col.sort!==false && h("span", {className:"sort-icon"}, sortCol===col.key?(sortDir==="asc"?"\u25B2":"\u25BC"):"\u25BC"));
              })
            )
          ),
          h("tbody", null,
            paged.map(function(p) {
              var grade = getGrade(p.investmentScore||0);
              var isStarred = shortlist.indexOf(p.id) >= 0;
              var scorePct = Math.min(100, ((p.investmentScore||0)/12)*100);
              var barColor = grade==="A"?"#4ADE80":grade==="B"?"#60A5FA":grade==="C"?"#FBBF24":grade==="D"?"#FB923C":"#F87171";
              return h("tr", {key:p.id, onClick:function(){setSelectedProp(p);}},
                h("td", {className:"star-cell"+(isStarred?" starred":""), onClick:function(e){e.stopPropagation();toggleShortlist(p.id);}},
                  h("svg", {viewBox:"0 0 24 24", width:16, height:16}, h("path", {d:"M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"}))
                ),
                h("td", {className:"addr-cell"}, p.address),
                h("td", {className:"col-med"}, TYPE_LABEL[p.homeType]||p.homeType||"N/A"),
                h("td", null, fmtK(p.assessedValue)),
                h("td", {className:"col-wide"}, p.sqft?fmtNum(p.sqft):"N/A"),
                h("td", {className:"col-wide"}, p.yearBuilt||"N/A"),
                h("td", {className:"col-wide"}, p.village||"N/A"),
                h("td", null,
                  h("div", {className:"score-bar"},
                    h("span", null, p.investmentScore||0),
                    h("div", {className:"bar"}, h("div", {className:"fill", style:{width:scorePct+"%",background:barColor}}))
                  )
                ),
                h("td", null, h("span", {className:"grade grade-"+grade}, grade)),
                h("td", {className:"col-med"}, h("span", {className:"strat-badge "+STRAT_CLS(p.strategy)}, STRAT_SHORT[p.strategy]||p.strategy||"N/A")),
                h("td", {className:"col-med"}, p.estROI!=null?fmtPct(p.estROI):"N/A"),
                h("td", null, fmtK(p.estProfit))
              );
            })
          )
        )
      ),
      renderPagination()
    );
  }

  return h("div", {id:"app"},
    // Guide overlay (when re-opened)
    showGuide && h(IntroGuide, {onClose:function(){setShowGuide(false);}}),
    // Section nav
    h("div", {className:"section-nav"},
      h("div", {className:"nav-brand"},
        h("svg", {viewBox:"0 0 24 24", width:18, height:18}, h("path", {fill:ACCENT, d:"M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z"})),
        h("span", null, TOWN)
      ),
      h("div", {className:"nav-tabs"},
        SECTIONS.map(function(s) {
          return h("button", {key:s.key, className:section===s.key?"active":"", onClick:function(){setSection(s.key);}}, s.label);
        })
      ),
      h("div", {className:"nav-actions"},
        h("button", {className:"help-nav-btn", onClick:function(){setShowGuide(true);}, title:"Help"}, "? Guide")
      )
    ),
    // Content
    h("div", {className:"content-area", ref:scrollRef},
      renderSection(),
      h("div", {className:"mls-disclaimer"},
        TOWN+" MA Investment Analysis \u00B7 Steinmetz Real Estate \u00B7 William Raveis \u00B7 Generated "+(MARKET.dataDate||new Date().toLocaleDateString()),
        (MLS_ACTIVE.length > 0 || MLS_SOLDS.length > 0) && h("br"),
        (MLS_ACTIVE.length > 0 || MLS_SOLDS.length > 0) && "Listing data provided by MLS Property Information Network, Inc. Information deemed reliable but not guaranteed."
      )
    ),
    // Modals
    selectedProp && h(PropertyModal, {property:selectedProp, onClose:function(){setSelectedProp(null);}, onToggleStar:toggleShortlist, isStarred:shortlist.indexOf(selectedProp.id)>=0}),
    showCompare && shortlistedProps.length >= 2 && h(ComparePanel, {properties:shortlistedProps.slice(0,4), onClose:function(){setShowCompare(false);}})
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
