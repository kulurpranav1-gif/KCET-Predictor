import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SpeedInsights } from "@vercel/speed-insights/react";
import supabase from "./supabase";

const categoryOptions = ["GM", "GMK", "GMR", "1G", "1K", "1R", "2AG", "2AK", "2AR", "2BG", "2BK", "2BR", "3AG", "3AK", "3AR", "3BG", "3BK", "3BR", "SCG", "SCK", "SCR", "STG", "STK", "STR"];
const defaultBranchOptions = ["Computer Science", "Information Science", "Electronics", "Aeronautical & Aerospace", "Artificial Intelligence", "Data Science", "Cyber Security", "Robotics & Automation", "Biotechnology & Biomedical", "Chemical", "Civil", "Construction & Management", "Environmental", "Electrical", "Mechanical", "Industrial & Production", "Polymer Science", "Agricultural", "Automobile", "Petroleum", "Mining", "Marine", "Textile", "Design", "Planning (B.Plan)"];
const branchKeywordMap = {
  "Computer Science": ["computer science", "cse", "artificial intelligence", "machine learning", "data science", "cyber security", "cybersecurity", "information technology"],
  "Information Science": ["information science", "information technology", "is&e", "ise"],
  Electronics: ["electronics", "communication", "telecommunication", "instrumentation", "embedded"],
  "Artificial Intelligence": ["artificial intelligence", "machine learning", "ai"],
  "Data Science": ["data science", "analytics", "big data"],
  "Cyber Security": ["cyber security", "cybersecurity", "information security"],
  "Robotics & Automation": ["robotics", "automation", "robotic", "industrial iot"],
  "Biotechnology & Biomedical": ["biotechnology", "bio- technology", "bio technology", "biomedical", "bio-medical", "medical engineering"],
  Chemical: ["chemical", "ceramics", "cement", "pharmaceutic"],
  Civil: ["civil engineering", "civil"],
  "Construction & Management": ["construction", "sustainability engineering", "industrial engineering & management", "management", "civil construction", "mgmt"],
  Environmental: ["environmental"],
  Mechanical: ["mechanical", "mechatronics", "automobile", "industrial", "manufacturing"],
  Electrical: ["electrical", "eee", "e&e", "power systems"],
  "Aeronautical & Aerospace": ["aero space", "aerospace", "aeronautical", "mechanical and aerospace"],
  "Industrial & Production": ["industrial & production", "production engineering", "industrial engineering", "manufacturing", "engineering design"],
  "Polymer Science": ["polymer science", "polymer"],
  Agricultural: ["agriculture engineering", "agricultural engineering"],
  Automobile: ["automobile", "automotive", "electric vehicle"],
  Petroleum: ["petroleum"],
  Mining: ["mining"],
  Marine: ["marine"],
  Textile: ["textiles", "silk technology"],
  Design: ["design"],
  "Planning (B.Plan)": ["b.plan", "planning"],
};
const allDistrictOptions = ["Bagalkote", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban", "Bidar", "Chamarajanagara", "Chikkaballapura", "Chikkamagaluru", "Chitradurga", "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga", "Tumakuru", "Udupi", "Uttara Kannada", "Vijayapura", "Vijayanagara", "Yadgiri"];
const MIN_OPTIONS_COUNT = 24;
const RESULTS_PER_PAGE = 20;
const MATCH_PRIORITY_ORDER = { Difficult: 0, Safe: 1 };

function normalizeCollegeCode(code) {
  return String(code ?? "").trim().toUpperCase().replace(/\s+/g, "");
}

function applyBranchFilter(query, selectedBranch) {
  const keywords = branchKeywordMap[selectedBranch];
  if (!keywords?.length) return query.ilike("branch", `%${selectedBranch}%`);
  return query.or(keywords.map((keyword) => `branch.ilike.%${keyword}%`).join(","));
}

function getMatchStrength(userRank, cutoffRank) {
  if (!Number.isFinite(userRank) || !Number.isFinite(cutoffRank) || cutoffRank <= 0) {
    return { label: "Difficult", tone: "bg-rose-100 text-rose-700 ring-rose-200" };
  }
  // KCET: lower rank is better.
  // Safe => user rank is at least 20% better (lower) than cutoff.
  if (userRank <= cutoffRank * 0.8) {
    return { label: "Safe", tone: "bg-emerald-100 text-emerald-700 ring-emerald-200" };
  }
  return { label: "Difficult", tone: "bg-rose-100 text-rose-700 ring-rose-200" };
}

export default function App() {
  const [rank, setRank] = useState("");
  const [pcmTotal, setPcmTotal] = useState("");
  const [kcetScore, setKcetScore] = useState("");
  const [estimatedRank, setEstimatedRank] = useState(null);
  const [calculatedPercent, setCalculatedPercent] = useState(null);
  const [calculatorLoading, setCalculatorLoading] = useState(false);
  const [calculatorError, setCalculatorError] = useState("");
  const [category, setCategory] = useState("GM");
  const [branch, setBranch] = useState(defaultBranchOptions[0]);
  const [districtList, setDistrictList] = useState(allDistrictOptions);
  const [selectedDistricts, setSelectedDistricts] = useState([]);
  const [districtSearch, setDistrictSearch] = useState("");
  const [collegeSearch, setCollegeSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadDistricts = async () => {
      const { data, error } = await supabase.from("cutoffs").select("district").not("district", "is", null).neq("district", "");
      if (error) return;
      const dbDistricts = Array.from(new Set((data ?? []).map((item) => item.district).filter(Boolean)));
      setDistrictList(Array.from(new Set([...allDistrictOptions, ...dbDistricts])).sort((a, b) => a.localeCompare(b)));
    };
    loadDistricts();
  }, []);

  const filteredDistrictList = useMemo(
    () => districtList.filter((district) => district.toLowerCase().includes(districtSearch.trim().toLowerCase())),
    [districtList, districtSearch]
  );

  const displayedResults = useMemo(
    () =>
      results
        .filter((item) =>
          item.collegeName.toLowerCase().includes(collegeSearch.trim().toLowerCase())
        )
        .sort((a, b) => {
          const priorityA = MATCH_PRIORITY_ORDER[a.match?.label] ?? 99;
          const priorityB = MATCH_PRIORITY_ORDER[b.match?.label] ?? 99;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          return Number(a.cutoffRank) - Number(b.cutoffRank);
        }),
    [results, collegeSearch]
  );
  const totalPages = Math.max(1, Math.ceil(displayedResults.length / RESULTS_PER_PAGE));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * RESULTS_PER_PAGE;
    return displayedResults.slice(start, start + RESULTS_PER_PAGE);
  }, [currentPage, displayedResults]);

  const locationSummary = selectedDistricts.length > 0 ? selectedDistricts.join(", ") : "All districts";

  useEffect(() => {
    setCurrentPage(1);
  }, [collegeSearch, results, selectedDistricts, category, branch]);

  const toggleDistrict = (district) => {
    setSelectedDistricts((prev) => (prev.includes(district) ? prev.filter((item) => item !== district) : [...prev, district]));
  };

  const fetchPredictions = async (rankOverride) => {
    const numericRank = Number(rankOverride ?? rank);
    if (!numericRank || numericRank <= 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    const selectedBranch = branch.trim();
    const selectedCategory = category.trim();
    const tier1LowerBound = numericRank * 0.7;
    const tier2UpperBound = numericRank * 1.1;

    try {
      const fetchCutoffs = async (useCategoryFilter) => {
        let windowQuery = supabase.from("cutoffs").select("*").gte("cutoff_rank", Math.floor(tier1LowerBound)).lte("cutoff_rank", Math.ceil(tier2UpperBound)).limit(120);
        let safeExpansionQuery = supabase.from("cutoffs").select("*").gt("cutoff_rank", Math.ceil(tier2UpperBound)).order("cutoff_rank", { ascending: true }).limit(120);
        windowQuery = applyBranchFilter(windowQuery, selectedBranch);
        safeExpansionQuery = applyBranchFilter(safeExpansionQuery, selectedBranch);
        if (useCategoryFilter) {
          windowQuery = windowQuery.ilike("category", selectedCategory);
          safeExpansionQuery = safeExpansionQuery.ilike("category", selectedCategory);
        }
        if (selectedDistricts.length > 0) {
          windowQuery = windowQuery.in("district", selectedDistricts);
          safeExpansionQuery = safeExpansionQuery.in("district", selectedDistricts);
        }
        const { data: windowData, error: windowError } = await windowQuery;
        if (windowError) return { rows: [], error: windowError };
        let rows = [...(windowData ?? [])];
        if (rows.length < MIN_OPTIONS_COUNT) {
          const { data: extraData } = await safeExpansionQuery;
          rows = [...rows, ...(extraData ?? [])];
        }
        return { rows, error: null };
      };

      const strictResult = await fetchCutoffs(true);
      if (strictResult.error) {
        console.error(strictResult.error);
        setResults([]);
        return;
      }
      const mergedData = strictResult.rows.length > 0 ? strictResult.rows : (await fetchCutoffs(false)).rows;
      const uniqueByCutoff = new Map();
      for (const item of mergedData) {
        const key = `${item.college_code}-${item.branch}-${item.category}-${item.cutoff_rank}`;
        if (!uniqueByCutoff.has(key)) uniqueByCutoff.set(key, item);
      }
      const prioritizedData = Array.from(uniqueByCutoff.values()).sort((a, b) => Number(a.cutoff_rank) - Number(b.cutoff_rank));
      const collegeCodes = Array.from(new Set(prioritizedData.map((item) => normalizeCollegeCode(item.college_code)).filter(Boolean)));
      let collegeNameByCode = {};
      if (collegeCodes.length > 0) {
        const { data: collegeRows } = await supabase.from("colleges").select("college_code, college_name").limit(5000);
        collegeNameByCode = (collegeRows ?? []).reduce((acc, row) => {
          const normalizedCode = normalizeCollegeCode(row.college_code);
          if (normalizedCode) acc[normalizedCode] = row.college_name;
          return acc;
        }, {});
      }

      setResults(
        prioritizedData.slice(0, MIN_OPTIONS_COUNT).map((item) => {
          const cutoffRank = Number(item.cutoff_rank);
          return {
            collegeCode: item.college_code,
            collegeName: collegeNameByCode[normalizeCollegeCode(item.college_code)] ?? item.college_name ?? item.college_code ?? "Unknown College",
            district: item.district ?? "",
            branch: item.branch,
            category: item.category,
            cutoffRank,
            match: getMatchStrength(numericRank, cutoffRank),
          };
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateRank = async () => {
    const pcmValue = Number(pcmTotal);
    const kcetValue = Number(kcetScore);
    if (!Number.isFinite(pcmValue) || !Number.isFinite(kcetValue) || pcmValue < 0 || pcmValue > 300 || kcetValue < 0 || kcetValue > 180) {
      setCalculatorError("Enter valid scores: PCM (0-300) and KCET (0-180).");
      setEstimatedRank(null);
      setCalculatedPercent(null);
      return;
    }
    setCalculatorLoading(true);
    setCalculatorError("");
    try {
      const totalPercent = (pcmValue / 300) * 50 + (kcetValue / 180) * 50;
      setCalculatedPercent(totalPercent);
      const { data, error } = await supabase.from("rank_predictions").select("predicted_rank").lte("min_percent", totalPercent).gte("max_percent", totalPercent).limit(1);
      if (error) {
        setCalculatorError("Unable to fetch estimated rank right now.");
        setEstimatedRank(null);
        return;
      }
      const predicted = data?.[0]?.predicted_rank ?? null;
      if (!predicted) {
        setCalculatorError("No estimated rank found for this score range.");
        setEstimatedRank(null);
        return;
      }
      setEstimatedRank(Number(predicted));
    } finally {
      setCalculatorLoading(false);
    }
  };

  const handleFindCollegesForEstimatedRank = async () => {
    if (!estimatedRank) return;
    setRank(String(estimatedRank));
    await fetchPredictions(estimatedRank);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-indigo-50/40 font-sans text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">KCET PREDICTOR</h1>
        <p className="mt-2 text-slate-600">Estimate your KCET rank, tune filters, and explore best-fit colleges instantly.</p>

        <section className="mt-8 rounded-2xl border border-white/40 bg-white/40 p-6 shadow-xl shadow-indigo-100 backdrop-blur-xl md:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              PUC PCM Total (out of 300)
              <input className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none ring-indigo-500 transition focus:ring-2" type="number" min="0" max="300" value={pcmTotal} onChange={(event) => setPcmTotal(event.target.value)} placeholder="e.g. 250" />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
              KCET Score (out of 180)
              <input className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none ring-indigo-500 transition focus:ring-2" type="number" min="0" max="180" value={kcetScore} onChange={(event) => setKcetScore(event.target.value)} placeholder="e.g. 120" />
            </label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white transition hover:bg-indigo-700" onClick={handleCalculateRank} disabled={calculatorLoading}>
              {calculatorLoading ? "Calculating..." : "Calculate Rank"}
            </button>
            <button type="button" className="rounded-xl border border-indigo-200 bg-white px-5 py-3 font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleFindCollegesForEstimatedRank} disabled={!estimatedRank || loading}>
              Find Colleges for this Rank
            </button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={estimatedRank ? "rank-ready" : "rank-empty"} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className={`mt-6 inline-flex min-w-72 flex-col rounded-2xl border border-indigo-200 bg-white px-6 py-4 shadow-md ${estimatedRank ? "pulse-badge" : ""}`}>
              <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600">Your Potential Rank</span>
              <span className="mt-1 text-4xl font-extrabold text-slate-900">{estimatedRank ? estimatedRank.toLocaleString() : "--"}</span>
              <span className="mt-2 text-sm text-slate-500">Weighted %: {Number.isFinite(calculatedPercent) ? calculatedPercent.toFixed(2) : "--"}</span>
            </motion.div>
          </AnimatePresence>
          {calculatorError ? <p className="mt-3 text-sm font-medium text-rose-600">{calculatorError}</p> : null}
          <p className="mt-3 text-xs text-slate-500">Estimates based on historical data. 2026 actual ranks may vary.</p>
        </section>

        <section className="sticky top-3 z-30 mt-6 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              👤 Category
              <select className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Branch
              <select className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800" value={branch} onChange={(event) => setBranch(event.target.value)}>
                {defaultBranchOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>📍 Districts</span>
              <details className="group relative">
                <summary className="cursor-pointer list-none rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800">
                  {selectedDistricts.length > 0 ? `${selectedDistricts.length} selected` : "All districts"}
                </summary>
                <div className="absolute z-40 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <input className="mb-2 w-full rounded-md border border-slate-300 px-2 py-1 text-sm" value={districtSearch} onChange={(event) => setDistrictSearch(event.target.value)} placeholder="Search district..." />
                  <button type="button" className="mb-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800" onClick={() => setSelectedDistricts([])}>Clear all</button>
                  {filteredDistrictList.map((district) => (
                    <label key={district} className="mb-1 flex items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={selectedDistricts.includes(district)} onChange={() => toggleDistrict(district)} />
                      <span>{district}</span>
                    </label>
                  ))}
                </div>
              </details>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Instant Search
              <input className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-indigo-500 focus:ring-2" value={collegeSearch} onChange={(event) => setCollegeSearch(event.target.value)} placeholder="Filter by college name..." />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rank</label>
            <input className="w-40 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 outline-none ring-indigo-500 focus:ring-2" type="number" min="1" value={rank} onChange={(event) => setRank(event.target.value)} placeholder="Enter rank" />
            <button type="button" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700" onClick={() => fetchPredictions()} disabled={loading}>
              {loading ? "Finding..." : "Run Prediction"}
            </button>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              Showing <span className="font-bold text-slate-900">{displayedResults.length}</span> colleges in <span className="text-indigo-700">{locationSummary}</span>
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Priority: Difficult → Safe
            </p>
          </div>
          {displayedResults.length === 0 && !loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">No colleges found for current filters.</div>
          ) : null}
          <div className="flex flex-col gap-4">
            <AnimatePresence>
              {paginatedResults.map((college, index) => {
                const priorityNumber = (currentPage - 1) * RESULTS_PER_PAGE + index + 1;
                return (
                <motion.article key={`${college.collegeCode}-${college.cutoffRank}-${index}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <header className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-indigo-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                          Option #{priorityNumber}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{college.collegeName}</h3>
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          [{college.collegeCode}]
                        </span>
                      </header>
                      <p className="mb-3 text-sm text-slate-600">
                        <span className="mr-1">📍</span>
                        {college.district || "Unknown District"}
                      </p>
                      <span className="inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">{college.branch}</span>
                    </div>
                    <div className="flex shrink-0 items-center justify-between gap-4 border-t border-slate-100 pt-3 md:border-t-0 md:pt-0">
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Cutoff Rank</p>
                        <p className="text-lg font-bold text-slate-900">{college.cutoffRank.toLocaleString()}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${college.match.tone}`}>Match: {college.match.label}</span>
                    </div>
                  </div>
                </motion.article>
              );
              })}
            </AnimatePresence>
          </div>
          {displayedResults.length > RESULTS_PER_PAGE ? (
            <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-600">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 disabled:opacity-50"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <SpeedInsights />
    </main>
  );
}
