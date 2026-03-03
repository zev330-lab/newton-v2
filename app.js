/* Newton Investment Analyzer v2 */
const h = React.createElement;
const {useState, useEffect, useMemo, useRef} = React;

const TOWN = "Newton";
const BG = "#1B2A4A";
const ACCENT = "#D4A843";

const PROPERTIES = window.__PROPERTIES__ || [];
const MARKET = window.__MARKET__ || {};
const MLS_ACTIVE = window.__MLS_ACTIVE__ || [];
const MLS_SOLDS = window.__MLS_SOLDS__ || [];
const MLS_RENTALS = window.__MLS_RENTALS__ || {};
const STATS = window.__STATS__ || {};

function getGrade(s) { return s >= 11 ? "A" : s >= 9 ? "B" : s >= 7 ? "C" : s >= 5 ? "D" : "F"; }
function fmt(n) { return n == null || isNaN(n) ? "N/A" : "$" + Number(n).toLocaleString("en-US", {maximumFractionDigits:0}); }
function fmtK(n) { if (n == null || isNaN(n)) return "N/A"; n = Number(n); return Math.abs(n) >= 1e6 ? "$" + (n/1e6).toFixed(1) + "M" : Math.abs(n) >= 1e3 ? "$" + Math.round(n/1e3) + "K" : "$" + n; }
function fmtPct(n) { return n == null || isNaN(n) ? "N/A" : Number(n).toFixed(1) + "%"; }
function fmtNum(n) { return n == null || isNaN(n) ? "N/A" : Number(n).toLocaleString("en-US"); }

var medianPSF = MARKET.medianPSF || 400;
var avgRentPSF = MARKET.rentPerSqft || 1.5;
var STRAT_SHORT = {"Flip":"Flip","Hold":"Hold","BRRRR":"BRRRR","Value-Add":"V-Add"};
var STRAT_CLS = function(s) { return "strat-" + (s||"").toLowerCase().replace(/[^a-z]/g,""); };
var TYPE_LABEL = {"SF":"SF","MultiSmall":"Multi","Condo":"Condo","Apt":"Apt","MultiLarge":"Multi+","LD":"Land"};
var ALL_TYPES = [];
var ALL_AREAS = [];
(function() {
  var ts = {}, as = {};
  PROPERTIES.forEach(function(p) { if (p.homeType) ts[p.homeType] = 1; if (p.village) as[p.village] = 1; });
  ALL_TYPES = Object.keys(ts).sort();
  ALL_AREAS = Object.keys(as).sort();
})();

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
    check();
    return function() { window.removeEventListener("resize", check); };
  }, []);

  if (!show) return null;

  return h("div", {className:"splash"},
    h("h1", null, TOWN),
    h("p", {className:"splash-sub"}, "Investment Analyzer"),
    h("div", {className:"splash-line"}),
    h("p", {className:"splash-brand"}, "Steinmetz Real Estate"),
    h("p", {className:"splash-brand2"}, "William Raveis"),
    h("div", {style:{height:"2rem"}}),
    h("p", {className:"splash-hint"}, "For the best experience, rotate to landscape"),
    h("button", {className:"splash-btn", onClick:function(){setShow(false);onContinue();}}, "Continue")
  );
}

// ── Intro Guide ──
var GUIDE_PAGES = [
  {title:"Welcome", text:TOWN+" Investment Analyzer helps you evaluate real estate investment opportunities. Browse properties, analyze deals, and compare strategies."},
  {title:"Scoring", text:"Properties scored 0\u201312 on value metrics: price/sqft vs market median, type, and other factors. Grades: A (11\u201312), B (9\u201310), C (7\u20138), D (5\u20136), F (0\u20134)."},
  {title:"How to Use", text:"Filter and sort properties in the table. Tap any row for detailed Flip, Hold, BRRRR, and Value-Add analysis. Star properties to shortlist and compare side by side."},
  {title:"Data", text:"Property data from public records. MLS data from MLS Property Information Network. Values are projections for screening \u2014 always do your own due diligence."}
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
        h("button", {className:"secondary", style:{visibility:page===0?"hidden":"visible"}, onClick:function(){setPage(page-1);}}, "Back"),
        h("div", {className:"guide-dots"},
          GUIDE_PAGES.map(function(_,i){return h("span",{key:i,className:i===page?"active":""});})
        ),
        h("button", {onClick:function(){page===GUIDE_PAGES.length-1?onClose():setPage(page+1);}}, page===GUIDE_PAGES.length-1?"Get Started":"Next")
      )
    )
  );
}

// ── Property Detail Modal ──
function PropertyModal(props) {
  var p = props.property, onClose = props.onClose;
  var ts = useState("flip"), tab = ts[0], setTab = ts[1];
  var is = useState({
    purchasePrice: String(p.assessedValue||0),
    renoBudget: String(p.estRenoBudget||Math.round((p.sqft||0)*85)),
    arv: String(p.estARV||Math.round((p.sqft||0)*medianPSF*1.2)),
    monthlyRent: String(p.estMonthlyRent||Math.round((p.sqft||0)*avgRentPSF)),
    interestRate:"6.0", downPayment:"25", holdingMonths:"6", commission:"4.0"
  }), inputs = is[0], setInputs = is[1];
  var rs = useState(null), results = rs[0], setResults = rs[1];

  useEffect(function(){recalculate();}, [tab]);

  function handleInput(f,v){setInputs(function(prev){var o={};for(var k in prev)o[k]=prev[k];o[f]=v;return o;});}

  function recalculate() {
    var pp=parseFloat(inputs.purchasePrice)||0, reno=parseFloat(inputs.renoBudget)||0;
    var arv=parseFloat(inputs.arv)||0, rent=parseFloat(inputs.monthlyRent)||0;
    var rate=(parseFloat(inputs.interestRate)||6)/100, dp=(parseFloat(inputs.downPayment)||25)/100;
    var months=parseInt(inputs.holdingMonths)||6, commPct=(parseFloat(inputs.commission)||4)/100;
    var downAmt=pp*dp, loanAmt=pp*(1-dp), mr=rate/12;
    var mp=loanAmt>0&&mr>0?loanAmt*(mr*Math.pow(1+mr,360))/(Math.pow(1+mr,360)-1):0;

    if(tab==="flip"){
      var hc=mp*months,pc=pp*commPct,sc=arv*0.05,tc=pp+reno+hc+pc+sc;
      var profit=arv-tc,ci=downAmt+reno+pc,roi=ci>0?(profit/ci)*100:0;
      setResults({type:"flip",cards:[
        {l:"Purchase Price",v:fmt(pp)},{l:"Reno Budget",v:fmt(reno)},{l:"Holding Cost",v:fmt(hc)},
        {l:"Purchase Comm.",v:fmt(pc)},{l:"Selling Cost (5%)",v:fmt(sc)},{l:"Total Cost",v:fmt(tc)},
        {l:"ARV",v:fmt(arv)},{l:"Profit",v:fmt(profit),p:profit>=0},{l:"Cash Invested",v:fmt(ci)},{l:"ROI",v:fmtPct(roi),p:roi>=0}
      ]});
    } else if(tab==="hold"){
      var mtx=(pp*(MARKET.taxRate||0.012))/12, mins=(MARKET.insuranceAnnual||2500)/12;
      var maint=pp*(MARKET.maintenancePct||0.01)/12, vac=rent*(MARKET.vacancyRate||0.05);
      var mcf=rent-mp-mtx-mins-maint-vac, ar=rent*12, ae=(mtx+mins+maint+vac)*12;
      var noi=ar-ae, cap=pp>0?(noi/pp)*100:0, gy=pp>0?(ar/pp)*100:0;
      var acf=mcf*12, coc=downAmt>0?(acf/downAmt)*100:0;
      setResults({type:"hold",cards:[
        {l:"Monthly Rent",v:fmt(rent)},{l:"Mortgage",v:fmt(mp)},{l:"Tax (monthly)",v:fmt(mtx)},
        {l:"Insurance",v:fmt(mins)},{l:"Maintenance",v:fmt(maint)},{l:"Vacancy (5%)",v:fmt(vac)},
        {l:"Monthly Cash Flow",v:fmt(mcf),p:mcf>=0},{l:"NOI",v:fmt(noi),p:noi>=0},
        {l:"Cap Rate",v:fmtPct(cap)},{l:"Gross Yield",v:fmtPct(gy)},{l:"Cash-on-Cash",v:fmtPct(coc),p:coc>=0}
      ]});
    } else if(tab==="brrrr"){
      var cc=pp*0.03, ci2=downAmt+reno+cc, rv=arv*0.75, cl=ci2-rv;
      var rmr=rate/12, rpmt=rv>0&&rmr>0?rv*(rmr*Math.pow(1+rmr,360))/(Math.pow(1+rmr,360)-1):0;
      var mtx2=(arv*0.012)/12, mins2=(arv*0.005)/12;
      var prcf=rent-rpmt-mtx2-mins2-(rent*0.15);
      setResults({type:"brrrr",cards:[
        {l:"Down Payment",v:fmt(downAmt)},{l:"Reno Budget",v:fmt(reno)},{l:"Closing Costs",v:fmt(cc)},
        {l:"Total Cash In",v:fmt(ci2)},{l:"Refi @ 75% ARV",v:fmt(rv)},{l:"Cash Left in Deal",v:fmt(cl),p:cl<=0},
        {l:"Refi Payment",v:fmt(rpmt)},{l:"Post-Refi Cash Flow",v:fmt(prcf),p:prcf>=0}
      ]});
    } else if(tab==="valueadd"){
      var bv=pp, av=arv, app=av-bv, eq=app-reno;
      var fap=bv>0?(app/bv)*100:0, roir=reno>0?(app/reno)*100:0;
      setResults({type:"valueadd",cards:[
        {l:"Before Value",v:fmt(bv)},{l:"After Value (ARV)",v:fmt(av)},
        {l:"Forced Appreciation",v:fmt(app),p:app>=0},{l:"Reno Cost",v:fmt(reno)},
        {l:"Equity Created",v:fmt(eq),p:eq>=0},{l:"Appreciation %",v:fmtPct(fap)},{l:"ROI on Reno",v:fmtPct(roir)}
      ]});
    }
  }

  var tabs=["flip","hold","brrrr","valueadd"];
  var tabLabels={flip:"Flip",hold:"Hold",brrrr:"BRRRR",valueadd:"Value-Add"};
  var grade=getGrade(p.investmentScore||0);
  var inputFields=[
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
          h("p", null, (p.village||TOWN) + (p.zip?", "+p.zip:"") + " | " + (p.homeType||"N/A") + (p.owner?" | "+p.owner:"") + " | Score: "+(p.investmentScore||0)+" ("+grade+")")
        ),
        h("button", {className:"close-modal", onClick:onClose}, "\u00D7")
      ),
      p.mlsListNo && h("img", {
        className:"modal-photo",
        src:"https://media.mlspin.com/photo.aspx?mls="+p.mlsListNo+"&n=0&w=900&h=500",
        alt:p.address,
        onError:function(e){e.target.style.display="none";}
      }),
      h("div", {className:"strategy-tabs"},
        tabs.map(function(t){return h("button",{key:t,className:tab===t?"active":"",onClick:function(){setTab(t);}},tabLabels[t]);})
      ),
      h("div", {className:"modal-body"},
        h("div", {className:"inputs-grid"},
          inputFields.map(function(f){
            return h("div",{key:f.key,className:"input-group"},
              h("label",null,f.label),
              h("input",{type:"text",inputMode:"decimal",value:inputs[f.key],onChange:function(e){handleInput(f.key,e.target.value);}})
            );
          })
        ),
        h("button", {className:"recalc-btn", onClick:recalculate}, "Recalculate"),
        results && h("div", {className:"results-section"},
          h("h3", null, tabLabels[tab]+" Analysis"),
          h("div", {className:"results-grid"},
            results.cards.map(function(c,i){
              return h("div",{key:i,className:"result-card"},
                h("div",{className:"label"},c.l),
                h("div",{className:"value"+(c.p===true?" positive":c.p===false?" negative":"")},c.v)
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
    {l:"Address",fn:function(p){return p.address;}},{l:"Type",fn:function(p){return p.homeType||"N/A";}},
    {l:"Area",fn:function(p){return p.village||"N/A";}},{l:"Assessed Value",fn:function(p){return fmt(p.assessedValue);}},
    {l:"Sqft",fn:function(p){return fmtNum(p.sqft);}},{l:"$/Sqft",fn:function(p){return fmt(p.pricePerSqft);}},
    {l:"Score",fn:function(p){return p.investmentScore||0;}},{l:"Grade",fn:function(p){return getGrade(p.investmentScore||0);}},
    {l:"Strategy",fn:function(p){return p.strategy||"N/A";}},{l:"Est. ARV",fn:function(p){return fmt(p.estARV);}},
    {l:"Est. Profit",fn:function(p){return fmt(p.estProfit);}},{l:"Est. ROI",fn:function(p){return p.estROI?fmtPct(p.estROI):"N/A";}},
    {l:"Monthly Rent",fn:function(p){return fmt(p.estMonthlyRent);}},{l:"Gross Yield",fn:function(p){return p.estGrossYield?fmtPct(p.estGrossYield):"N/A";}}
  ];
  return h("div",{className:"compare-overlay",onClick:function(e){if(e.target===e.currentTarget)onClose();}},
    h("div",{className:"compare-panel"},
      h("button",{className:"close-modal",onClick:onClose},"\u00D7"),
      h("h2",null,"Compare Properties"),
      h("table",{className:"compare-table"},
        h("thead",null,h("tr",null,h("th",null,"Metric"),properties.map(function(p,i){return h("th",{key:i},p.address);}))),
        h("tbody",null,metrics.map(function(m,i){
          return h("tr",{key:i},h("td",{style:{color:ACCENT,fontWeight:600}},m.l),properties.map(function(p,j){return h("td",{key:j},m.fn(p));}));
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
  return h("div",{className:"dash-cards"},
    cards.map(function(c,i){
      return h("div",{key:i,className:"dash-card"},
        h("div",{className:"dc-label"},c.l),
        h("div",{className:"dc-value"},c.v),
        c.s&&h("div",{className:"dc-sub"},c.s)
      );
    })
  );
}

// ── Filter Bar ──
function FilterBar(props) {
  var filters=props.filters, onChange=props.onChange, count=props.count, total=props.total;
  var sm=useState(false), showMore=sm[0], setShowMore=sm[1];

  function toggle(field,val){
    var next={};for(var k in filters)next[k]=filters[k];
    var arr=next[field].slice();
    var idx=arr.indexOf(val);
    if(idx>=0)arr.splice(idx,1);else arr.push(val);
    next[field]=arr;onChange(next);
  }
  function set(field,val){var next={};for(var k in filters)next[k]=filters[k];next[field]=val;onChange(next);}
  function reset(){var r={};for(var k in INIT_FILTERS)r[k]=Array.isArray(INIT_FILTERS[k])?[]:INIT_FILTERS[k];onChange(r);setShowMore(false);}

  function chip(label,active,onClick){
    return h("button",{className:"chip"+(active?" chip-on":""),onClick:onClick},label);
  }

  return h("div",{className:"filter-bar"},
    h("div",{className:"fb-row"},
      h("div",{className:"fb-search"},
        h("svg",{viewBox:"0 0 24 24",width:14,height:14},
          h("path",{fill:"var(--text-muted)",d:"M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 5 1.49-1.49-5-5zm-6 0A4.5 4.5 0 1114 9.5 4.5 4.5 0 019.5 14z"})
        ),
        h("input",{type:"text",placeholder:"Search address or owner\u2026",value:filters.search,onChange:function(e){set("search",e.target.value);}})
      ),
      h("span",{className:"fb-count"},count+" of "+total)
    ),
    h("div",{className:"fb-row fb-chips"},
      ["Flip","Hold","BRRRR","Value-Add"].map(function(s){return chip(STRAT_SHORT[s]||s,filters.strategies.indexOf(s)>=0,function(){toggle("strategies",s);});}),
      h("span",{className:"fb-sep"}),
      ["A","B","C","D","F"].map(function(g){return chip(g,filters.grades.indexOf(g)>=0,function(){toggle("grades",g);});}),
      h("button",{className:"chip chip-action",onClick:function(){setShowMore(!showMore);}},showMore?"Less \u25B2":"More \u25BC"),
      h("button",{className:"chip chip-reset",onClick:reset},"Reset")
    ),
    showMore&&h("div",{className:"fb-more"},
      h("div",{className:"fb-sliders"},
        h("div",{className:"fb-slider"},
          h("label",null,"Min Score: "+filters.minScore),
          h("input",{type:"range",min:0,max:12,step:1,value:filters.minScore,onChange:function(e){set("minScore",parseInt(e.target.value));}})
        ),
        h("div",{className:"fb-slider"},
          h("label",null,"Min Tenure: "+filters.minTenure+"yr"),
          h("input",{type:"range",min:0,max:125,step:5,value:filters.minTenure,onChange:function(e){set("minTenure",parseInt(e.target.value));}})
        ),
        h("div",{className:"fb-slider"},
          h("label",null,"Min ROI: "+filters.minROI+"%"),
          h("input",{type:"range",min:0,max:100,step:5,value:filters.minROI,onChange:function(e){set("minROI",parseInt(e.target.value));}})
        )
      ),
      h("div",{className:"fb-ranges"},
        h("div",{className:"fb-range"},
          h("label",null,"Price"),
          h("input",{type:"number",placeholder:"Min",value:filters.priceMin,onChange:function(e){set("priceMin",e.target.value);}}),
          h("span",null,"\u2013"),
          h("input",{type:"number",placeholder:"Max",value:filters.priceMax,onChange:function(e){set("priceMax",e.target.value);}})
        ),
        h("div",{className:"fb-range"},
          h("label",null,"Sqft"),
          h("input",{type:"number",placeholder:"Min",value:filters.sqftMin,onChange:function(e){set("sqftMin",e.target.value);}}),
          h("span",null,"\u2013"),
          h("input",{type:"number",placeholder:"Max",value:filters.sqftMax,onChange:function(e){set("sqftMax",e.target.value);}})
        )
      ),
      h("div",{className:"fb-row fb-chips"},
        ALL_TYPES.map(function(t){return chip(TYPE_LABEL[t]||t,filters.types.indexOf(t)>=0,function(){toggle("types",t);});}),
        h("select",{className:"fb-select",value:filters.area,onChange:function(e){set("area",e.target.value);}},
          h("option",{value:"all"},"All Areas"),
          ALL_AREAS.map(function(a){return h("option",{key:a,value:a},a);})
        )
      ),
      h("div",{className:"fb-ranges"},
        h("div",{className:"fb-range"},
          h("label",null,"Year Built"),
          h("input",{type:"number",placeholder:"Min",value:filters.yearMin,onChange:function(e){set("yearMin",e.target.value);}}),
          h("span",null,"\u2013"),
          h("input",{type:"number",placeholder:"Max",value:filters.yearMax,onChange:function(e){set("yearMax",e.target.value);}})
        )
      )
    )
  );
}

// ── MLS Type Badge ──
function typeBadge(t) {
  var cls = t==="SF"?"mls-badge-sf":t==="MF"?"mls-badge-mf":t==="CC"?"mls-badge-cc":"mls-badge-ld";
  return h("span",{className:"mls-badge "+cls},t);
}

// ── Active Listings Section ──
function ActiveSection() {
  if(MLS_ACTIVE.length===0) return h("div",{className:"section-empty"},"No active listings available");
  return h("div",{className:"section-content"},
    h("div",{className:"mls-grid"},
      MLS_ACTIVE.slice(0,30).map(function(lst,i){
        return h("div",{key:i,className:"mls-card"},
          lst.photo_count>0
            ?h("img",{src:"https://media.mlspin.com/photo.aspx?mls="+lst.list_no+"&n=0&w=600&h=450",alt:lst.address,loading:"lazy",onError:function(e){e.target.style.display="none";}})
            :h("div",{className:"mls-nophoto"},"No Photo"),
          h("div",{className:"mls-info"},
            h("div",{className:"mls-addr"},lst.address,lst.unit?" #"+lst.unit:"", " ",typeBadge(lst.type)),
            h("div",{className:"mls-price"},fmt(lst.price)),
            h("div",{className:"mls-meta"},
              [lst.beds?lst.beds+"BR":null,lst.sqft?fmtNum(lst.sqft)+" sqft":null,lst.sqft&&lst.price?"$"+Math.round(lst.price/lst.sqft)+"/sqft":null].filter(Boolean).join(" \u00B7 ")||"MLS #"+lst.list_no
            )
          )
        );
      })
    )
  );
}

// ── Recent Sales Section ──
function SalesSection() {
  if(MLS_SOLDS.length===0) return h("div",{className:"section-empty"},"No recent sales data available");
  return h("div",{className:"section-content"},
    h("table",{className:"mls-sold-table"},
      h("thead",null,h("tr",null,
        h("th",null,"Address"),h("th",null,"Type"),h("th",null,"Sale Price"),h("th",null,"Date"),h("th",{className:"col-wide"},"Sqft"),h("th",{className:"col-wide"},"$/Sqft")
      )),
      h("tbody",null,MLS_SOLDS.map(function(s,i){
        return h("tr",{key:i},
          h("td",{style:{fontWeight:500}},s.address),
          h("td",null,typeBadge(s.type)),
          h("td",{style:{color:"var(--accent)",fontWeight:600}},fmt(s.sale_price)),
          h("td",null,s.sale_date||"N/A"),
          h("td",{className:"col-wide"},s.sqft?fmtNum(s.sqft):"N/A"),
          h("td",{className:"col-wide"},s.psf?"$"+s.psf:"N/A")
        );
      }))
    )
  );
}

// ── Rental Snapshot Section ──
function RentalsSection() {
  var r = MLS_RENTALS;
  if(!r||!r.medianRent) return h("div",{className:"section-empty"},"Limited rental data for this market");
  var beds = r.byBedrooms || {};
  var statCards = [
    {l:"Total Listings",v:r.total||0,s:"active rentals"},
    {l:"Median Rent",v:fmt(r.medianRent),s:"all sizes"},
    {l:"Rent Range",v:r.rentRange?fmt(r.rentRange[0])+" \u2013 "+fmt(r.rentRange[1]):"N/A",s:"min to max"}
  ];
  if(r.rentPerSqft) statCards.push({l:"Rent/Sqft",v:"$"+r.rentPerSqft,s:"per month"});
  Object.keys(beds).forEach(function(b){
    statCards.push({l:b+" Bedroom",v:fmt(beds[b]),s:"median asking"});
  });
  return h("div",{className:"section-content"},
    h("div",{className:"rent-stats"},
      statCards.map(function(c,i){
        return h("div",{key:i,className:"rent-stat"},
          h("div",{className:"rs-label"},c.l),
          h("div",{className:"rs-value"},c.v),
          h("div",{className:"rs-sub"},c.s)
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
  var sls = useState(false), showShortlist = sls[0], setShowShortlist = sls[1];
  var cmp = useState(false), showCompare = cmp[0], setShowCompare = cmp[1];

  // Load shortlist
  useEffect(function(){
    try{var s=localStorage.getItem(TOWN.toLowerCase()+"_shortlist");if(s)setShortlist(JSON.parse(s));}catch(e){}
  },[]);
  useEffect(function(){
    localStorage.setItem(TOWN.toLowerCase()+"_shortlist",JSON.stringify(shortlist));
  },[shortlist]);

  // Lock body scroll when modal open
  useEffect(function(){
    document.body.style.overflow=selectedProp?"hidden":"";
    return function(){document.body.style.overflow="";};
  },[selectedProp]);

  function toggleShortlist(id){
    setShortlist(function(prev){return prev.indexOf(id)>=0?prev.filter(function(x){return x!==id;}):prev.concat([id]);});
  }

  // Filter + sort
  var filtered = useMemo(function(){
    var list = PROPERTIES;
    if(filters.search){
      var s=filters.search.toLowerCase();
      list=list.filter(function(p){return (p.address||"").toLowerCase().indexOf(s)>=0||(p.owner||"").toLowerCase().indexOf(s)>=0;});
    }
    if(filters.strategies.length>0) list=list.filter(function(p){return filters.strategies.indexOf(p.strategy)>=0;});
    if(filters.grades.length>0) list=list.filter(function(p){return filters.grades.indexOf(getGrade(p.investmentScore||0))>=0;});
    if(filters.types.length>0) list=list.filter(function(p){return filters.types.indexOf(p.homeType)>=0;});
    if(filters.minScore>0) list=list.filter(function(p){return (p.investmentScore||0)>=filters.minScore;});
    if(filters.minTenure>0) list=list.filter(function(p){return (p.tenure||0)>=filters.minTenure;});
    if(filters.minROI>0) list=list.filter(function(p){return (p.estROI||0)>=filters.minROI;});
    if(filters.priceMin) list=list.filter(function(p){return (p.assessedValue||0)>=parseFloat(filters.priceMin);});
    if(filters.priceMax) list=list.filter(function(p){return (p.assessedValue||0)<=parseFloat(filters.priceMax);});
    if(filters.sqftMin) list=list.filter(function(p){return (p.sqft||0)>=parseFloat(filters.sqftMin);});
    if(filters.sqftMax) list=list.filter(function(p){return (p.sqft||0)<=parseFloat(filters.sqftMax);});
    if(filters.area!=="all") list=list.filter(function(p){return p.village===filters.area;});
    if(filters.yearMin) list=list.filter(function(p){return p.yearBuilt&&p.yearBuilt>=parseInt(filters.yearMin);});
    if(filters.yearMax) list=list.filter(function(p){return p.yearBuilt&&p.yearBuilt<=parseInt(filters.yearMax);});

    list=list.slice().sort(function(a,b){
      var va=a[sortCol],vb=b[sortCol];
      if(va==null)va=sortDir==="asc"?Infinity:-Infinity;
      if(vb==null)vb=sortDir==="asc"?Infinity:-Infinity;
      if(typeof va==="string") return sortDir==="asc"?va.localeCompare(vb):vb.localeCompare(va);
      return sortDir==="asc"?va-vb:vb-va;
    });
    return list;
  },[filters,sortCol,sortDir]);

  function handleSort(col){
    if(sortCol===col){setSortDir(function(d){return d==="asc"?"desc":"asc";});}
    else{setSortCol(col);setSortDir("desc");}
  }

  var shortlistedProps=PROPERTIES.filter(function(p){return shortlist.indexOf(p.id)>=0;});

  if(phase==="splash") return h(SplashScreen,{onContinue:function(){setPhase("guide");}});
  if(phase==="guide") return h(IntroGuide,{onClose:function(){setPhase("app");}});

  var columns = [
    {key:"_star",label:"\u2606",sort:false,cls:""},
    {key:"address",label:"Address",cls:""},
    {key:"homeType",label:"Type",cls:"col-med"},
    {key:"assessedValue",label:"Value",cls:""},
    {key:"sqft",label:"Sqft",cls:"col-wide"},
    {key:"yearBuilt",label:"Year",cls:"col-wide"},
    {key:"village",label:"Area",cls:"col-wide"},
    {key:"investmentScore",label:"Score",cls:""},
    {key:"_grade",label:"Grade",cls:"col-med"},
    {key:"strategy",label:"Strat",cls:"col-med"},
    {key:"estROI",label:"ROI%",cls:"col-med"},
    {key:"estProfit",label:"Profit",cls:"col-med"}
  ];

  var SECTIONS = [
    {key:"properties",label:"Properties"},
    {key:"active",label:"Active ("+MLS_ACTIVE.length+")"},
    {key:"sales",label:"Sales ("+MLS_SOLDS.length+")"},
    {key:"rentals",label:"Rentals"}
  ];

  function renderSection() {
    if(section==="active") return h(ActiveSection);
    if(section==="sales") return h(SalesSection);
    if(section==="rentals") return h(RentalsSection);

    // Properties section
    return h("div", null,
      h(DashboardCards),
      h(FilterBar,{filters:filters,onChange:setFilters,count:filtered.length,total:PROPERTIES.length}),
      h("div",{className:"stats-bar"},
        h("span",null,"Showing: ",h("span",{className:"accent"},filtered.length)," of ",PROPERTIES.length),
        h("span",null,"Shortlisted: ",h("span",{className:"accent"},shortlist.length)),
        h("span",null,"Avg Score: ",h("span",{className:"accent"},filtered.length>0?(filtered.reduce(function(s,p){return s+(p.investmentScore||0);},0)/filtered.length).toFixed(1):"0"))
      ),
      h("table",null,
        h("thead",null,
          h("tr",null,
            columns.map(function(col){
              return h("th",{
                key:col.key,
                className:(sortCol===col.key?"sorted":"")+(col.cls?" "+col.cls:""),
                onClick:col.sort!==false?function(){handleSort(col.key);}:undefined
              },col.label,col.sort!==false&&h("span",{className:"sort-icon"},sortCol===col.key?(sortDir==="asc"?" \u25B2":" \u25BC"):" \u25BC"));
            })
          )
        ),
        h("tbody",null,
          filtered.map(function(p){
            var grade=getGrade(p.investmentScore||0);
            var isStarred=shortlist.indexOf(p.id)>=0;
            var scorePct=Math.min(100,((p.investmentScore||0)/12)*100);
            var barColor=grade==="A"?"#4ADE80":grade==="B"?"#60A5FA":grade==="C"?"#FBBF24":grade==="D"?"#FB923C":"#F87171";
            return h("tr",{key:p.id,onClick:function(){setSelectedProp(p);}},
              h("td",{className:"star-cell"+(isStarred?" starred":""),onClick:function(e){e.stopPropagation();toggleShortlist(p.id);}},
                h("svg",{viewBox:"0 0 24 24",width:16,height:16},h("path",{d:"M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z"}))
              ),
              h("td",{className:"addr-cell"},p.address),
              h("td",{className:"col-med"},p.homeType||"N/A"),
              h("td",null,fmtK(p.assessedValue)),
              h("td",{className:"col-wide"},p.sqft?fmtNum(p.sqft):"N/A"),
              h("td",{className:"col-wide"},p.yearBuilt||"N/A"),
              h("td",{className:"col-wide"},p.village||"N/A"),
              h("td",null,
                h("div",{className:"score-bar"},
                  h("span",null,p.investmentScore||0),
                  h("div",{className:"bar"},h("div",{className:"fill",style:{width:scorePct+"%",background:barColor}}))
                )
              ),
              h("td",{className:"col-med"},h("span",{className:"grade grade-"+grade},grade)),
              h("td",{className:"col-med"},h("span",{className:"strat-badge "+STRAT_CLS(p.strategy)},STRAT_SHORT[p.strategy]||p.strategy||"N/A")),
              h("td",{className:"col-med"},p.estROI!=null?fmtPct(p.estROI):"N/A"),
              h("td",{className:"col-med"},fmtK(p.estProfit))
            );
          })
        )
      )
    );
  }

  return h("div", {id:"app"},
    // Section nav (sticky)
    h("div",{className:"section-nav"},
      h("div",{className:"nav-brand"},
        h("svg",{viewBox:"0 0 24 24",width:18,height:18},h("path",{fill:ACCENT,d:"M12 3L2 12h3v8h6v-5h2v5h6v-8h3L12 3z"})),
        h("span",null,TOWN)
      ),
      h("div",{className:"nav-tabs"},
        SECTIONS.map(function(s){
          return h("button",{key:s.key,className:section===s.key?"active":"",onClick:function(){setSection(s.key);}},s.label);
        })
      ),
      h("div",{className:"nav-actions"},
        h("button",{className:"shortlist-btn"+(showShortlist?" active":""),onClick:function(){setShowShortlist(!showShortlist);}},"\u2605 "+shortlist.length),
        h("button",{className:"compare-btn",disabled:shortlist.length<2,onClick:function(){setShowCompare(true);}},"Compare")
      )
    ),
    // Content
    h("div",{className:"content-area"},
      renderSection(),
      h("div",{className:"mls-disclaimer"},
        "Listing data provided by MLS Property Information Network, Inc. Information deemed reliable but not guaranteed. Data refreshed "+(MARKET.dataDate||"N/A")+". For informational purposes only. | Steinmetz Real Estate \u00B7 William Raveis"
      )
    ),
    // Modals
    selectedProp&&h(PropertyModal,{property:selectedProp,onClose:function(){setSelectedProp(null);}}),
    showCompare&&shortlistedProps.length>=2&&h(ComparePanel,{properties:shortlistedProps.slice(0,3),onClose:function(){setShowCompare(false);}}),
    h("div",{className:"shortlist-panel"+(showShortlist?" open":"")},
      h("div",{className:"panel-header"},
        h("h3",null,"Shortlist ("+shortlist.length+")"),
        h("button",{onClick:function(){setShowShortlist(false);}},"\u00D7")
      ),
      h("div",{className:"panel-body"},
        shortlistedProps.length===0
          ?h("div",{className:"shortlist-empty"},"Star properties to add them here")
          :shortlistedProps.map(function(p){
            return h("div",{key:p.id,className:"shortlist-item",onClick:function(){setSelectedProp(p);setShowShortlist(false);}},
              h("div",null,
                h("div",{className:"addr"},p.address),
                h("div",{className:"meta"},[p.homeType,fmtK(p.assessedValue),"Score: "+(p.investmentScore||0)].join(" | "))
              ),
              h("button",{className:"remove-btn",onClick:function(e){e.stopPropagation();toggleShortlist(p.id);}},"\u00D7")
            );
          })
      )
    ),
    h("button",{className:"help-btn",onClick:function(){setPhase("guide");},title:"Help"},"?")
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));
