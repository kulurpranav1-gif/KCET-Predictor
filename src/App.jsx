import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import cutoffsCsv from "./final_cutoffs.csv?raw";

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

/**
 * Historical-style KCET Engg score→rank bands for the official 50:50 formula:
 * totalPercent = (PCM/300)*50 + (KCET/180)*50
 * These bands approximate recent-year GM trends (not official KEA data).
 * Cutoff CSV must NOT be used to invent exam ranks — it only holds college closing ranks.
 */
const RANK_PREDICTION_BANDS = [
  { min_percent: 95, max_percent: 100, predicted_rank: 350 },
  { min_percent: 92, max_percent: 95, predicted_rank: 900 },
  { min_percent: 90, max_percent: 92, predicted_rank: 1600 },
  { min_percent: 87, max_percent: 90, predicted_rank: 2800 },
  { min_percent: 85, max_percent: 87, predicted_rank: 4200 },
  { min_percent: 82, max_percent: 85, predicted_rank: 6500 },
  { min_percent: 80, max_percent: 82, predicted_rank: 9000 },
  { min_percent: 77, max_percent: 80, predicted_rank: 12000 },
  { min_percent: 75, max_percent: 77, predicted_rank: 15500 },
  { min_percent: 72, max_percent: 75, predicted_rank: 21000 },
  { min_percent: 70, max_percent: 72, predicted_rank: 28000 },
  { min_percent: 67, max_percent: 70, predicted_rank: 38000 },
  { min_percent: 65, max_percent: 67, predicted_rank: 48000 },
  { min_percent: 62, max_percent: 65, predicted_rank: 62000 },
  { min_percent: 60, max_percent: 62, predicted_rank: 78000 },
  { min_percent: 55, max_percent: 60, predicted_rank: 100000 },
  { min_percent: 50, max_percent: 55, predicted_rank: 130000 },
  { min_percent: 45, max_percent: 50, predicted_rank: 160000 },
  { min_percent: 40, max_percent: 45, predicted_rank: 190000 },
  { min_percent: 0, max_percent: 40, predicted_rank: 220000 },
];

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      if (current.length > 0 || row.length > 0) {
        row.push(current);
        rows.push(row);
        row = [];
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function branchMatches(branchName, selectedBranch) {
  const branchText = String(branchName ?? "").toLowerCase();
  if (!branchText) return false;
  const keywords = branchKeywordMap[selectedBranch];
  if (!keywords?.length) {
    return branchText.includes(selectedBranch.toLowerCase());
  }
  return keywords.some((keyword) => branchText.includes(keyword.toLowerCase()));
}

function estimateRankFromPercent(totalPercent) {
  const percentile = Math.min(100, Math.max(0, totalPercent));
  const band = RANK_PREDICTION_BANDS.find(
    (row) => percentile >= row.min_percent && percentile <= row.max_percent
  );
  if (!band) return null;

  // Interpolate within the band so higher % inside a band gets a better (lower) rank.
  const span = Math.max(0.0001, band.max_percent - band.min_percent);
  const nextBetter = RANK_PREDICTION_BANDS.find((row) => row.min_percent >= band.max_percent);
  const betterRank = nextBetter ? nextBetter.predicted_rank : Math.max(1, Math.floor(band.predicted_rank * 0.55));
  const t = (percentile - band.min_percent) / span;
  const predicted = Math.round(band.predicted_rank + (betterRank - band.predicted_rank) * t);

  console.log("[KCET debug] rank bands lookup", {
    totalPercent: percentile,
    matchedBand: band,
    betterRank,
    interpolationT: Number(t.toFixed(4)),
    predictedRank: predicted,
  });

  return Math.max(1, predicted);
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
  const [allCutoffs, setAllCutoffs] = useState([]);
  const [dataError, setDataError] = useState("");
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
  const [predictionError, setPredictionError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    try {
      const parsedRows = parseCsv(cutoffsCsv);
      const [headerRow, ...bodyRows] = parsedRows;
      const headers = (headerRow ?? []).map((value) => value.trim().toLowerCase());
      const normalizedRows = bodyRows
        .map((cells) => {
          const row = {};
          headers.forEach((header, idx) => {
            row[header] = String(cells[idx] ?? "").trim();
          });
          return row;
        })
        .filter((row) => row.branch && row.category && row.cutoff_rank);
      setAllCutoffs(normalizedRows);
      const csvDistricts = Array.from(new Set(normalizedRows.map((item) => item.district).filter(Boolean)));
      setDistrictList(Array.from(new Set([...allDistrictOptions, ...csvDistricts])).sort((a, b) => a.localeCompare(b)));
      setDataError("");
      console.log("[KCET debug] CSV loaded", {
        recordCount: normalizedRows.length,
        sampleRows: normalizedRows.slice(0, 3),
        sampleCutoffRanks: normalizedRows.slice(0, 5).map((row) => ({
          college: row.college_name?.slice(0, 40),
          branch: row.branch,
          category: row.category,
          cutoff_rank: row.cutoff_rank,
        })),
      });
    } catch (error) {
      console.error(error);
      setDataError("Unable to read final_cutoffs.csv. Ensure src/final_cutoffs.csv exists and is valid CSV.");
    }
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
      setPredictionError("Enter a valid rank greater than 0.");
      return;
    }
    setLoading(true);
    setPredictionError("");
    const selectedBranch = branch.trim();
    const selectedCategory = category.trim();
    const tier1LowerBound = numericRank * 0.7;
    const tier2UpperBound = numericRank * 1.1;

    try {
      const fetchCutoffs = (useCategoryFilter) => {
        let rows = allCutoffs.filter((item) => {
          const cutoffRank = Number(item.cutoff_rank);
          if (!Number.isFinite(cutoffRank)) return false;
          if (useCategoryFilter && item.category !== selectedCategory) return false;
          if (selectedDistricts.length > 0 && !selectedDistricts.includes(item.district)) return false;
          if (!branchMatches(item.branch, selectedBranch)) return false;
          return true;
        });

        const inWindow = rows.filter((item) => {
          const cutoffRank = Number(item.cutoff_rank);
          return cutoffRank >= Math.floor(tier1LowerBound) && cutoffRank <= Math.ceil(tier2UpperBound);
        });
        const expanded = rows
          .filter((item) => Number(item.cutoff_rank) > Math.ceil(tier2UpperBound))
          .sort((a, b) => Number(a.cutoff_rank) - Number(b.cutoff_rank))
          .slice(0, 400);

        rows = inWindow.length >= MIN_OPTIONS_COUNT ? inWindow : [...inWindow, ...expanded];
        return { rows, error: null };
      };

      const strictResult = await fetchCutoffs(true);
      if (strictResult.error) {
        console.error(strictResult.error);
        setResults([]);
        setPredictionError("Unable to load colleges from CSV.");
        return;
      }
      let mergedData = strictResult.rows;
      if (mergedData.length === 0) {
        const relaxedResult = await fetchCutoffs(false);
        if (relaxedResult.error) {
          console.error(relaxedResult.error);
          setResults([]);
          setPredictionError("Unable to load colleges from CSV.");
          return;
        }
        mergedData = relaxedResult.rows;
      }
      const uniqueByCutoff = new Map();
      for (const item of mergedData) {
        const key = `${item.college_code}-${item.branch}-${item.category}-${item.cutoff_rank}`;
        if (!uniqueByCutoff.has(key)) uniqueByCutoff.set(key, item);
      }
      const prioritizedData = Array.from(uniqueByCutoff.values()).sort((a, b) => Number(a.cutoff_rank) - Number(b.cutoff_rank));
      if (prioritizedData.length === 0) {
        setResults([]);
        setPredictionError("No colleges match your rank, branch, category, and district filters. Try clearing districts or choosing another branch.");
        return;
      }

      console.log("[KCET debug] college recommendations", {
        userRank: numericRank,
        category: selectedCategory,
        branch: selectedBranch,
        matchedCount: prioritizedData.length,
        showing: Math.min(MIN_OPTIONS_COUNT, prioritizedData.length),
        sample: prioritizedData.slice(0, 3).map((item) => ({
          college: item.college_name,
          branch: item.branch,
          category: item.category,
          cutoff_rank: item.cutoff_rank,
        })),
      });

      setResults(
        prioritizedData.slice(0, MIN_OPTIONS_COUNT).map((item) => {
          const cutoffRank = Number(item.cutoff_rank);
          return {
            collegeCode: item.college_code,
            collegeName: item.college_name ?? item.college_code ?? "Unknown College",
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
      const pcmContribution = (pcmValue / 300) * 50;
      const kcetContribution = (kcetValue / 180) * 50;
      const totalPercent = pcmContribution + kcetContribution;
      console.log("[KCET debug] input marks", {
        pcmTotal: pcmValue,
        kcetScore: kcetValue,
        pcmContribution: Number(pcmContribution.toFixed(4)),
        kcetContribution: Number(kcetContribution.toFixed(4)),
        totalPercent: Number(totalPercent.toFixed(4)),
      });
      setCalculatedPercent(totalPercent);
      const predicted = estimateRankFromPercent(totalPercent);
      if (!predicted) {
        setCalculatorError("Unable to estimate rank for this score range.");
        setEstimatedRank(null);
        return;
      }
      console.log("[KCET debug] predicted rank result", { totalPercent, predicted });
      setEstimatedRank(predicted);
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
        {dataError ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
            <p className="font-semibold">CSV data problem</p>
            <p className="mt-1">{dataError}</p>
          </div>
        ) : null}

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
          {predictionError ? <p className="mb-3 text-sm font-medium text-rose-600">{predictionError}</p> : null}
          {displayedResults.length === 0 && !loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
              {predictionError || "No colleges found for current filters. Enter a rank and click Run Prediction."}
            </div>
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
    </main>
  );
}
