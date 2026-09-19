import { i as __toESM } from "../_runtime.mjs";
import { L as require_react, v as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Scale, c as LayoutGrid, d as ArrowDownRight, i as SlidersHorizontal, l as GitFork, n as Waypoints, o as Map$1, s as MapPin, t as X, u as ArrowUpRight } from "../_libs/lucide-react.mjs";
import { t as create } from "../_libs/zustand.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { a as ResponsiveContainer, i as Bar, n as YAxis, o as Tooltip, r as XAxis, t as BarChart } from "../_libs/recharts+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CgMFxAmq.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TRIP_TYPES = [
	{
		id: "contained",
		label: "Contained",
		hint: "Start and end inside Sharjah"
	},
	{
		id: "inbound",
		label: "Inbound",
		hint: "Enter the study area"
	},
	{
		id: "outbound",
		label: "Outbound",
		hint: "Leave the study area"
	},
	{
		id: "through",
		label: "Through",
		hint: "Pass through without stopping"
	}
];
var TYPE_INDEX = {
	contained: 0,
	inbound: 1,
	outbound: 2,
	through: 3
};
var ALL_TRIP_TYPES = [
	"contained",
	"inbound",
	"outbound",
	"through"
];
var HEAT = [
	"#1a2c36",
	"#214754",
	"#2b6874",
	"#3d8aa0",
	"#b9a888",
	"#e4d4bc"
];
function pairKey(o, d) {
	return `${o},${d}`;
}
async function loadAnalysis() {
	const [metaRes, odRes, geoRes] = await Promise.all([
		fetch("/data/meta.json"),
		fetch("/data/od.json"),
		fetch("/data/regions.geojson")
	]);
	if (!metaRes.ok || !odRes.ok || !geoRes.ok) throw new Error("Could not load analysis data");
	const metaFile = await metaRes.json();
	const odFile = await odRes.json();
	const geojson = await geoRes.json();
	const n = metaFile.regions.length;
	const matrix = new Float64Array(n * n);
	const od = odFile.od.map(([o, d, v, types]) => {
		matrix[o * n + d] = v;
		return {
			o,
			d,
			v,
			types: [
				types[0] ?? 0,
				types[1] ?? 0,
				types[2] ?? 0,
				types[3] ?? 0
			]
		};
	});
	const hoursByPair = /* @__PURE__ */ new Map();
	for (const [o, d, hs] of odFile.hours) hoursByPair.set(pairKey(o, d), hs.map((x) => x / 1e3));
	const via = odFile.via.map(([o, d, v, val]) => ({
		o,
		d,
		v,
		val
	}));
	const viaByPair = /* @__PURE__ */ new Map();
	for (const row of via) {
		const k = pairKey(row.o, row.d);
		const list = viaByPair.get(k);
		if (list) list.push(row);
		else viaByPair.set(k, [row]);
	}
	const histograms = odFile.histograms;
	return {
		meta: metaFile.meta,
		insights: metaFile.insights,
		regions: metaFile.regions,
		od,
		matrix,
		hoursByPair,
		via,
		viaByPair,
		histograms,
		geojson
	};
}
function regionLabel(region, mode) {
	return mode === "en" ? region.en : region.name;
}
function quantileBreaks(values, k = 6) {
	const sorted = values.filter((v) => v > 0).sort((a, b) => a - b);
	if (sorted.length === 0) return Array.from({ length: k - 1 }, () => 0);
	const breaks = [];
	for (let i = 1; i < k; i++) {
		const q = i / k;
		const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
		breaks.push(sorted[idx] ?? 0);
	}
	return breaks;
}
function binIndex(value, breaks) {
	let i = 0;
	while (i < breaks.length && value > breaks[i]) i++;
	return i;
}
function flowValue(row, types) {
	if (types.length === 0) return 0;
	if (types.length === ALL_TRIP_TYPES.length) return row.v;
	let sum = 0;
	for (const t of types) sum += row.types[TYPE_INDEX[t]] ?? 0;
	return sum;
}
function aggregateRegions(analysis, types) {
	const n = analysis.regions.length;
	if (types.length === ALL_TRIP_TYPES.length) return {
		origin: analysis.regions.map((r) => r.origin),
		dest: analysis.regions.map((r) => r.dest),
		internal: analysis.regions.map((r) => r.internal),
		touch: analysis.regions.map((r) => r.touch)
	};
	const origin = Array.from({ length: n }, () => 0);
	const dest = Array.from({ length: n }, () => 0);
	const internal = Array.from({ length: n }, () => 0);
	for (const row of analysis.od) {
		const v = flowValue(row, types);
		if (v <= 0) continue;
		origin[row.o] += v;
		dest[row.d] += v;
		if (row.o === row.d) internal[row.o] += v;
	}
	return {
		origin,
		dest,
		internal,
		touch: origin.map((o, i) => o + (dest[i] ?? 0) - (internal[i] ?? 0))
	};
}
function aggMetric(agg, region, metric) {
	if (metric === "via") return region.via;
	if (metric === "origin") return agg.origin[region.id] ?? 0;
	if (metric === "dest") return agg.dest[region.id] ?? 0;
	return agg.touch[region.id] ?? 0;
}
function buildFilteredMatrix(analysis, types) {
	if (types.length === ALL_TRIP_TYPES.length) return analysis.matrix;
	const n = analysis.regions.length;
	const m = new Float64Array(n * n);
	for (const row of analysis.od) m[row.o * n + row.d] = flowValue(row, types);
	return m;
}
function buildSankey(analysis, types, limit, mode) {
	const agg = aggregateRegions(analysis, types);
	const ranked = [...analysis.regions].sort((a, b) => (agg.touch[b.id] ?? 0) - (agg.touch[a.id] ?? 0)).slice(0, limit);
	const ids = ranked.map((r) => r.id);
	const idSet = new Set(ids);
	const n = analysis.regions.length;
	const matrix = buildFilteredMatrix(analysis, types);
	const nodes = [...ranked.map((r) => ({
		name: regionLabel(r, mode),
		id: r.id,
		side: "origin"
	})), ...ranked.map((r) => ({
		name: regionLabel(r, mode),
		id: r.id,
		side: "dest"
	}))];
	const raw = [];
	for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
		const o = ids[i];
		const d = ids[j];
		if (!idSet.has(o) || !idSet.has(d)) continue;
		const value = matrix[o * n + d] ?? 0;
		if (value < .04) continue;
		raw.push({
			source: i,
			target: ids.length + j,
			value,
			o,
			d
		});
	}
	raw.sort((a, b) => b.value - a.value);
	return {
		nodes,
		links: raw.slice(0, Math.min(48, limit * 6)),
		originCount: ids.length
	};
}
var useOdStore = create((set) => ({
	view: "overview",
	metric: "touch",
	labelMode: "en",
	selectedId: null,
	hoveredId: null,
	origins: [],
	dests: [],
	vias: [],
	search: "",
	minFlow: .15,
	matrixLimit: 40,
	sankeyLimit: 8,
	tripTypes: [...ALL_TRIP_TYPES],
	showArcs: true,
	setView: (view) => set({ view }),
	setMetric: (metric) => set({ metric }),
	setLabelMode: (labelMode) => set({ labelMode }),
	setSelected: (selectedId) => set({ selectedId }),
	setHovered: (hoveredId) => set({ hoveredId }),
	toggleRole: (id, role) => set((s) => {
		const key = role === "origin" ? "origins" : role === "dest" ? "dests" : "vias";
		const list = s[key];
		const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
		return { [key]: next };
	}),
	clearRoles: () => set({
		origins: [],
		dests: [],
		vias: []
	}),
	setSearch: (search) => set({ search }),
	setMinFlow: (minFlow) => set({ minFlow }),
	setMatrixLimit: (matrixLimit) => set({ matrixLimit }),
	setSankeyLimit: (sankeyLimit) => set({ sankeyLimit }),
	toggleTripType: (t) => set((s) => {
		const has = s.tripTypes.includes(t);
		if (has && s.tripTypes.length === 1) return s;
		return { tripTypes: has ? s.tripTypes.filter((x) => x !== t) : [...s.tripTypes, t] };
	}),
	setTripTypes: (tripTypes) => set({ tripTypes }),
	setShowArcs: (showArcs) => set({ showArcs }),
	openPair: (o, d) => set({
		view: "flows",
		origins: [o],
		dests: [d],
		vias: [],
		selectedId: o
	})
}));
function flowArc(a, b, steps = 24) {
	const dx = b.lng - a.lng;
	const dy = b.lat - a.lat;
	const dist = Math.hypot(dx, dy) || 1;
	const mx = (a.lng + b.lng) / 2;
	const my = (a.lat + b.lat) / 2;
	const nx = -dy / dist;
	const ny = dx / dist;
	const bulge = dist * .22;
	const cx = mx + nx * bulge;
	const cy = my + ny * bulge;
	const coords = [];
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const u = 1 - t;
		coords.push([u * u * a.lng + 2 * u * t * cx + t * t * b.lng, u * u * a.lat + 2 * u * t * cy + t * t * b.lat]);
	}
	return {
		type: "Feature",
		properties: {},
		geometry: {
			type: "LineString",
			coordinates: coords
		}
	};
}
function OdMap({ analysis, flows = [] }) {
	const canvasRef = (0, import_react.useRef)(null);
	const wrapRef = (0, import_react.useRef)(null);
	const viewRef = (0, import_react.useRef)({
		scale: 1,
		tx: 0,
		ty: 0
	});
	const fitted = (0, import_react.useRef)(false);
	const drag = (0, import_react.useRef)(null);
	const hoverPx = (0, import_react.useRef)(null);
	const metric = useOdStore((s) => s.metric);
	const view = useOdStore((s) => s.view);
	const selectedId = useOdStore((s) => s.selectedId);
	const hoveredId = useOdStore((s) => s.hoveredId);
	const origins = useOdStore((s) => s.origins);
	const dests = useOdStore((s) => s.dests);
	const vias = useOdStore((s) => s.vias);
	const labelMode = useOdStore((s) => s.labelMode);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const showArcs = useOdStore((s) => s.showArcs);
	const setSelected = useOdStore((s) => s.setSelected);
	const setHovered = useOdStore((s) => s.setHovered);
	const toggleRole = useOdStore((s) => s.toggleRole);
	const n = analysis.regions.length;
	const agg = (0, import_react.useMemo)(() => aggregateRegions(analysis, tripTypes), [analysis, tripTypes]);
	const matrix = (0, import_react.useMemo)(() => buildFilteredMatrix(analysis, tripTypes), [analysis, tripTypes]);
	const bbox = analysis.meta.bbox;
	const colorById = (0, import_react.useMemo)(() => {
		const colors = {};
		if (view === "flows" && origins.length === 1 && dests.length === 0) {
			const o = origins[0];
			const breaks = quantileBreaks(analysis.regions.map((_, d) => matrix[o * n + d] ?? 0));
			for (const r of analysis.regions) {
				if (r.id === o) {
					colors[r.id] = "#7ea8c4";
					continue;
				}
				const v = matrix[o * n + r.id] ?? 0;
				colors[r.id] = v <= 0 ? "#151a22" : HEAT[binIndex(v, breaks)];
			}
			return colors;
		}
		if (view === "flows" && (origins.length || dests.length || vias.length)) {
			for (const r of analysis.regions) if (origins.includes(r.id)) colors[r.id] = "#7ea8c4";
			else if (dests.includes(r.id)) colors[r.id] = "#d6c4a8";
			else if (vias.includes(r.id)) colors[r.id] = "#5f9b94";
			else colors[r.id] = "#1a222c";
			if (origins.length === 1 && dests.length === 1) {
				const key = `${origins[0]},${dests[0]}`;
				const list = analysis.viaByPair.get(key) ?? [];
				const max = Math.max(...list.map((x) => x.val), .001);
				for (const row of list) {
					if (origins.includes(row.v) || dests.includes(row.v)) continue;
					const t = row.val / max;
					const idx = Math.min(5, Math.floor(t * 6));
					colors[row.v] = HEAT[idx];
				}
			}
			return colors;
		}
		const breaks = quantileBreaks(analysis.regions.map((r) => aggMetric(agg, r, metric)));
		for (const r of analysis.regions) {
			const v = aggMetric(agg, r, metric);
			colors[r.id] = v <= 0 ? "#151a22" : HEAT[binIndex(v, breaks)];
		}
		return colors;
	}, [
		analysis,
		metric,
		view,
		origins,
		dests,
		vias,
		n,
		agg,
		matrix
	]);
	const flowFc = (0, import_react.useMemo)(() => {
		if (view === "overview" && !showArcs) return [];
		const top = [...flows].sort((a, b) => b.v - a.v).slice(0, view === "overview" ? 48 : 80);
		const max = top[0]?.v ?? 1;
		return top.map((f) => {
			const a = analysis.regions[f.o];
			const b = analysis.regions[f.d];
			if (!a || !b || f.o === f.d) return null;
			return {
				coords: flowArc(a, b).geometry.coordinates,
				width: .8 + f.v / max * 5.2
			};
		}).filter((x) => x != null);
	}, [
		flows,
		analysis.regions,
		showArcs,
		view
	]);
	const paths = (0, import_react.useMemo)(() => buildPaths(analysis.geojson), [analysis.geojson]);
	const labels = (0, import_react.useMemo)(() => {
		return [...analysis.regions].sort((a, b) => (agg.touch[b.id] ?? 0) - (agg.touch[a.id] ?? 0)).slice(0, 12).map((r) => ({
			id: r.id,
			name: regionLabel(r, labelMode),
			lng: r.lng,
			lat: r.lat
		}));
	}, [
		analysis.regions,
		agg,
		labelMode
	]);
	const hovered = hoveredId != null ? analysis.regions[hoveredId] : null;
	function project(lng, lat, w, h, v) {
		const [west, south, east, north] = bbox;
		const pad = 28;
		const x = pad + (lng - west) / (east - west) * (w - 56);
		const y = pad + (north - lat) / (north - south) * (h - 56);
		return [x * v.scale + v.tx, y * v.scale + v.ty];
	}
	function hitTest(px, py, w, h) {
		const v = viewRef.current;
		for (let i = paths.length - 1; i >= 0; i--) {
			const p = paths[i];
			if (pointInRings(px, py, p.rings, (lng, lat) => project(lng, lat, w, h, v))) return p.id;
		}
		return null;
	}
	function draw() {
		const canvas = canvasRef.current;
		const wrap = wrapRef.current;
		if (!canvas || !wrap) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const w = wrap.clientWidth;
		const h = wrap.clientHeight;
		if (w < 8 || h < 8) return;
		canvas.width = Math.floor(w * dpr);
		canvas.height = Math.floor(h * dpr);
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, w, h);
		ctx.fillStyle = "#0c0f14";
		ctx.fillRect(0, 0, w, h);
		const v = viewRef.current;
		if (!fitted.current) {
			fitted.current = true;
			viewRef.current = {
				scale: 1,
				tx: 0,
				ty: 0
			};
		}
		for (const p of paths) {
			ctx.beginPath();
			for (const ring of p.rings) {
				ring.forEach(([lng, lat], i) => {
					const [x, y] = project(lng, lat, w, h, v);
					if (i === 0) ctx.moveTo(x, y);
					else ctx.lineTo(x, y);
				});
				ctx.closePath();
			}
			ctx.fillStyle = colorById[p.id] ?? "#1a2c36";
			ctx.fill("evenodd");
			ctx.strokeStyle = "#0c0f14";
			ctx.lineWidth = .6;
			ctx.stroke();
		}
		const hi = hoveredId ?? selectedId;
		if (hi != null) {
			const p = paths.find((x) => x.id === hi);
			if (p) {
				ctx.beginPath();
				for (const ring of p.rings) {
					ring.forEach(([lng, lat], i) => {
						const [x, y] = project(lng, lat, w, h, v);
						if (i === 0) ctx.moveTo(x, y);
						else ctx.lineTo(x, y);
					});
					ctx.closePath();
				}
				ctx.strokeStyle = "#e8eaed";
				ctx.lineWidth = 1.8;
				ctx.stroke();
			}
		}
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		for (const f of flowFc) {
			ctx.beginPath();
			f.coords.forEach(([lng, lat], i) => {
				const [x, y] = project(lng, lat, w, h, v);
				if (i === 0) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			});
			ctx.strokeStyle = "rgba(158,182,200,0.72)";
			ctx.lineWidth = f.width;
			ctx.stroke();
		}
		ctx.font = "11px IBM Plex Sans, sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		for (const lab of labels) {
			const [x, y] = project(lab.lng, lab.lat, w, h, v);
			ctx.lineWidth = 3;
			ctx.strokeStyle = "#0c0f14";
			ctx.strokeText(lab.name, x, y);
			ctx.fillStyle = "#e8eaed";
			ctx.fillText(lab.name, x, y);
		}
	}
	(0, import_react.useEffect)(() => {
		draw();
		const wrap = wrapRef.current;
		const canvas = canvasRef.current;
		if (!wrap || !canvas) return;
		const ro = new ResizeObserver(() => draw());
		ro.observe(wrap);
		const onWheel = (e) => {
			e.preventDefault();
			const rect = wrap.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			const v = viewRef.current;
			const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
			const next = Math.min(6, Math.max(.7, v.scale * factor));
			const k = next / v.scale;
			viewRef.current = {
				scale: next,
				tx: x - (x - v.tx) * k,
				ty: y - (y - v.ty) * k
			};
			draw();
		};
		wrap.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			ro.disconnect();
			wrap.removeEventListener("wheel", onWheel);
		};
	}, [
		colorById,
		flowFc,
		labels,
		hoveredId,
		selectedId,
		paths
	]);
	function toLocal(e) {
		const rect = wrapRef.current.getBoundingClientRect();
		return {
			x: e.clientX - rect.left,
			y: e.clientY - rect.top,
			w: rect.width,
			h: rect.height
		};
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		ref: wrapRef,
		className: "absolute inset-0 overflow-hidden",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				className: "absolute inset-0 h-full w-full touch-none",
				onPointerDown: (e) => {
					const { x, y } = toLocal(e);
					drag.current = {
						x,
						y,
						tx: viewRef.current.tx,
						ty: viewRef.current.ty
					};
					e.target.setPointerCapture(e.pointerId);
				},
				onPointerMove: (e) => {
					const { x, y, w, h } = toLocal(e);
					hoverPx.current = {
						x,
						y
					};
					if (drag.current) {
						const dx = Math.abs(x - drag.current.x);
						const dy = Math.abs(y - drag.current.y);
						if (dx > 3 || dy > 3) {
							viewRef.current = {
								...viewRef.current,
								tx: drag.current.tx + (x - drag.current.x),
								ty: drag.current.ty + (y - drag.current.y)
							};
							draw();
						}
						return;
					}
					const id = hitTest(x, y, w, h);
					if (id !== hoveredId) setHovered(id);
				},
				onPointerUp: (e) => {
					const start = drag.current;
					drag.current = null;
					const { x, y, w, h } = toLocal(e);
					if (!start) return;
					if (Math.hypot(x - start.x, y - start.y) > 5) return;
					const id = hitTest(x, y, w, h);
					if (id == null) return;
					const store = useOdStore.getState();
					setSelected(id);
					if (store.view === "flows") {
						if (store.origins.length === 0) toggleRole(id, "origin");
						else if (store.dests.length === 0 && !store.origins.includes(id)) toggleRole(id, "dest");
					}
				},
				onPointerLeave: () => {
					drag.current = null;
					setHovered(null);
				}
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "absolute right-3 bottom-24 z-10 flex flex-col overflow-hidden rounded-sm border border-border bg-surface",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center text-lg text-fg hover:bg-hover",
						onClick: () => {
							const wrap = wrapRef.current;
							if (!wrap) return;
							const x = wrap.clientWidth / 2;
							const y = wrap.clientHeight / 2;
							const v = viewRef.current;
							const next = Math.min(6, v.scale * 1.2);
							const k = next / v.scale;
							viewRef.current = {
								scale: next,
								tx: x - (x - v.tx) * k,
								ty: y - (y - v.ty) * k
							};
							draw();
						},
						"aria-label": "Zoom in",
						children: "+"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center border-t border-border text-lg text-fg hover:bg-hover",
						onClick: () => {
							const wrap = wrapRef.current;
							if (!wrap) return;
							const x = wrap.clientWidth / 2;
							const y = wrap.clientHeight / 2;
							const v = viewRef.current;
							const next = Math.max(.7, v.scale / 1.2);
							const k = next / v.scale;
							viewRef.current = {
								scale: next,
								tx: x - (x - v.tx) * k,
								ty: y - (y - v.ty) * k
							};
							draw();
						},
						"aria-label": "Zoom out",
						children: "−"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						className: "flex size-10 items-center justify-center border-t border-border text-xs text-muted hover:bg-hover hover:text-fg",
						onClick: () => {
							viewRef.current = {
								scale: 1,
								tx: 0,
								ty: 0
							};
							draw();
						},
						"aria-label": "Reset view",
						children: "Fit"
					})
				]
			}),
			hovered ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute z-10 w-48 rounded-sm border border-border bg-raised px-3 py-2 text-xs shadow-lg",
				style: {
					left: Math.min((hoverPx.current?.x ?? 16) + 14, (wrapRef.current?.clientWidth ?? 320) - 200),
					top: Math.min((hoverPx.current?.y ?? 16) + 14, (wrapRef.current?.clientHeight ?? 240) - 140)
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "font-medium",
						dir: "auto",
						children: regionLabel(hovered, labelMode)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mb-1 text-subtle",
						dir: "auto",
						children: labelMode === "en" ? hovered.name : hovered.en
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 tabular",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: "Touching"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [hovered.touch.toFixed(2), "%"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: "Origin"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [hovered.origin.toFixed(2), "%"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: "Destination"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [hovered.dest.toFixed(2), "%"] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-muted",
								children: "Via"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [hovered.via.toFixed(2), "%"] })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-1 text-[10px] text-subtle",
						children: metricHint(metric, tripTypes)
					})
				]
			}) : null
		]
	});
}
function metricHint(m, _types) {
	if (m === "touch") return "Colored by trips touching the region";
	if (m === "origin") return "Colored by trip origins";
	if (m === "dest") return "Colored by trip destinations";
	return "Colored by through-traffic";
}
function buildPaths(fc) {
	const out = [];
	for (const f of fc.features) {
		const id = Number(f.properties?.id);
		if (!Number.isFinite(id) || !f.geometry) continue;
		const rings = [];
		const g = f.geometry;
		if (g.type === "Polygon") for (const ring of g.coordinates) rings.push(ring.map(([lng, lat]) => [lng, lat]));
		else if (g.type === "MultiPolygon") for (const poly of g.coordinates) for (const ring of poly) rings.push(ring.map(([lng, lat]) => [lng, lat]));
		if (rings.length) out.push({
			id,
			rings
		});
	}
	return out;
}
function pointInRings(px, py, rings, proj) {
	let inside = false;
	for (const ring of rings) if (pointInPoly(px, py, ring.map(([lng, lat]) => proj(lng, lat)))) inside = !inside;
	return inside;
}
function pointInPoly(x, y, pts) {
	let inside = false;
	for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
		const xi = pts[i][0];
		const yi = pts[i][1];
		const xj = pts[j][0];
		const yj = pts[j][1];
		if (yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi + 1e-7) + xi) inside = !inside;
	}
	return inside;
}
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function fmtPct(value, digits = 2) {
	return `${value.toFixed(digits)}%`;
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-[color,background-color,border-color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-40", {
	variants: {
		variant: {
			default: "bg-fg text-bg hover:bg-accent",
			secondary: "bg-raised text-fg border border-border hover:bg-hover",
			ghost: "text-muted hover:bg-hover hover:text-fg",
			accent: "bg-accent text-accent-fg hover:bg-fg",
			origin: "bg-role-o/20 text-role-o border border-role-o/40 hover:bg-role-o/30",
			dest: "bg-role-d/20 text-role-d border border-role-d/40 hover:bg-role-d/30",
			via: "bg-role-v/20 text-role-v border border-role-v/40 hover:bg-role-v/30"
		},
		size: {
			default: "h-10 px-3",
			sm: "h-8 px-2.5 text-xs",
			lg: "h-11 px-4",
			icon: "size-10",
			"icon-sm": "size-8"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = (0, import_react.forwardRef)(({ className, variant, size, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
	ref,
	className: cn(buttonVariants({
		variant,
		size
	}), className),
	...props
}));
Button.displayName = "Button";
var Input = (0, import_react.forwardRef)(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	ref,
	className: cn("flex h-10 w-full rounded-sm border border-border bg-raised px-3 text-sm text-fg placeholder:text-subtle outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50", className),
	...props
}));
Input.displayName = "Input";
function Separator({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "separator",
		className: cn("h-px w-full bg-border", className)
	});
}
function MiniHistogram({ title, histogram, maxBars = 24 }) {
	const data = (0, import_react.useMemo)(() => {
		const labels = histogram.labels;
		const values = histogram.values;
		const n = Math.min(labels.length, values.length, maxBars);
		const step = Math.max(1, Math.ceil(labels.length / n));
		const out = [];
		for (let i = 0; i < labels.length; i += step) {
			let sum = 0;
			for (let j = i; j < Math.min(i + step, values.length); j++) sum += values[j] ?? 0;
			const lab = labels[i];
			out.push({
				label: formatBin(lab, histogram.unit),
				value: sum
			});
		}
		return out;
	}, [histogram, maxBars]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-border bg-surface p-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-2 flex items-baseline justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-xs font-medium tracking-wide text-muted uppercase",
				children: title
			}), histogram.unit ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-xs text-subtle",
				children: histogram.unit
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "h-28",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResponsiveContainer, {
				width: "100%",
				height: "100%",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(BarChart, {
					data,
					margin: {
						top: 4,
						right: 0,
						left: -28,
						bottom: 0
					},
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(XAxis, {
							dataKey: "label",
							tick: {
								fill: "#8b939e",
								fontSize: 9
							},
							interval: "preserveStartEnd",
							axisLine: false,
							tickLine: false
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(YAxis, { hide: true }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tooltip, {
							cursor: { fill: "rgba(158,182,200,0.08)" },
							contentStyle: {
								background: "#1c232e",
								border: "1px solid #2a3340",
								borderRadius: 8,
								fontSize: 12,
								color: "#e8eaed"
							},
							formatter: (value) => [`${Number(value).toFixed(2)}%`, "Share"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bar, {
							dataKey: "value",
							fill: "#3d8aa0",
							radius: [
								2,
								2,
								0,
								0
							]
						})
					]
				})
			})
		})]
	});
}
function formatBin(label, unit) {
	if (unit === "min" || unit === "km" || unit === "km/h") return String(label);
	return `${label}`;
}
function TripTypeFilter({ compact = false }) {
	const tripTypes = useOdStore((s) => s.tripTypes);
	const toggleTripType = useOdStore((s) => s.toggleTripType);
	const setTripTypes = useOdStore((s) => s.setTripTypes);
	const allOn = tripTypes.length === ALL_TRIP_TYPES.length;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-1 overflow-x-auto",
		"aria-label": "Trip types",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			onClick: () => setTripTypes([...ALL_TRIP_TYPES]),
			className: cn("h-9 shrink-0 rounded-sm px-2.5 text-xs transition-[color,background-color] duration-150", allOn ? "bg-raised text-fg" : "text-muted hover:text-fg"),
			children: "All"
		}), TRIP_TYPES.map((t) => {
			const on = tripTypes.includes(t.id);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				title: t.hint,
				onClick: () => toggleTripType(t.id),
				className: cn("h-9 shrink-0 rounded-sm border px-2.5 text-xs transition-[color,background-color,border-color] duration-150", on ? cn("border-transparent text-bg", chipOn(t.id)) : "border-border text-muted hover:text-fg"),
				children: compact ? t.label.slice(0, 3) : t.label
			}, t.id);
		})]
	});
}
function chipOn(id) {
	if (id === "contained") return "bg-accent";
	if (id === "inbound") return "bg-role-o";
	if (id === "outbound") return "bg-role-d";
	return "bg-role-v";
}
function TypeMixBar({ contained, inbound, outbound, through }) {
	const total = contained + inbound + outbound + through || 1;
	const parts = [
		{
			id: "contained",
			v: contained,
			className: "bg-accent"
		},
		{
			id: "inbound",
			v: inbound,
			className: "bg-role-o"
		},
		{
			id: "outbound",
			v: outbound,
			className: "bg-role-d"
		},
		{
			id: "through",
			v: through,
			className: "bg-role-v"
		}
	];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex h-2 overflow-hidden rounded-full bg-hover",
		children: parts.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: p.className,
			style: { width: `${p.v / total * 100}%` },
			title: `${p.id} ${p.v.toFixed(1)}%`
		}, p.id))
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs",
		children: TRIP_TYPES.map((t, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex items-center gap-1.5 text-muted",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-2 rounded-xs", parts[i].className) }), t.label]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "tabular text-fg",
				children: [parts[i].v.toFixed(1), "%"]
			})]
		}, t.id))
	})] });
}
function OverviewPanel({ analysis }) {
	const metric = useOdStore((s) => s.metric);
	const setMetric = useOdStore((s) => s.setMetric);
	const selectedId = useOdStore((s) => s.selectedId);
	const setSelected = useOdStore((s) => s.setSelected);
	const labelMode = useOdStore((s) => s.labelMode);
	const openPair = useOdStore((s) => s.openPair);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const search = useOdStore((s) => s.search);
	const setSearch = useOdStore((s) => s.setSearch);
	const { insights, regions, meta } = analysis;
	const agg = aggregateRegions(analysis, tripTypes);
	const q = search.trim().toLowerCase();
	const ranked = [...regions].filter((r) => !q || r.en.toLowerCase().includes(q) || r.name.includes(search.trim())).sort((a, b) => aggMetric(agg, b, metric) - aggMetric(agg, a, metric));
	const breaks = quantileBreaks(regions.map((r) => aggMetric(agg, r, metric)));
	const selected = selectedId != null ? regions[selectedId] : null;
	const topInter = [...analysis.od].filter((r) => r.o !== r.d).sort((a, b) => flowValue(b, tripTypes) - flowValue(a, tripTypes))[0];
	const imb = regions[insights.imbalance.id];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-4 overflow-y-auto p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "text-xs font-medium tracking-wide text-muted uppercase",
				children: "Insights"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Contained origin",
						value: fmtPct(insights.containedOrigin),
						hint: "Starts and stays inside"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Contained dest",
						value: fmtPct(insights.containedDest),
						hint: "Ends inside the study area"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "External in",
						value: fmtPct(insights.externalIn),
						hint: "Enter from outside"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "External out",
						value: fmtPct(insights.externalOut),
						hint: "Leave the study area"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Through traffic",
						value: fmtPct(insights.through),
						hint: "Pass through without stopping"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
						label: "Internal trips",
						value: fmtPct(insights.internalShare),
						hint: "Origin equals destination"
					})
				]
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				className: "mb-2 text-xs font-medium tracking-wide text-muted uppercase",
				children: "Trip mix"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeMixBar, {
				contained: meta.types.contained,
				inbound: meta.types.inbound,
				outbound: meta.types.outbound,
				through: meta.types.through
			})] }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "space-y-1 text-sm",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InsightRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MapPin, { className: "size-3.5" }),
						label: "Busiest region",
						region: regions[insights.busiest.id],
						value: fmtPct(insights.busiest.touch),
						mode: labelMode,
						onClick: () => setSelected(insights.busiest.id)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InsightRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GitFork, { className: "size-3.5" }),
						label: "Top via region",
						region: regions[insights.topVia.id],
						value: fmtPct(insights.topVia.via),
						mode: labelMode,
						onClick: () => setSelected(insights.topVia.id)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InsightRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowDownRight, { className: "size-3.5" }),
						label: "Top entry gateway",
						region: regions[insights.topEntry.id],
						value: `${insights.topEntry.shareOfEntering.toFixed(1)}% of inbound`,
						mode: labelMode,
						onClick: () => setSelected(insights.topEntry.id)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(InsightRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpRight, { className: "size-3.5" }),
						label: "Top exit gateway",
						region: regions[insights.topExit.id],
						value: `${insights.topExit.shareOfExiting.toFixed(1)}% of outbound`,
						mode: labelMode,
						onClick: () => setSelected(insights.topExit.id)
					}),
					imb ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(InsightRow, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Scale, { className: "size-3.5" }),
						label: imb.dest > imb.origin ? "Strongest sink" : "Strongest source",
						region: imb,
						value: `${fmtPct(imb.origin)} → ${fmtPct(imb.dest)}`,
						mode: labelMode,
						onClick: () => setSelected(imb.id)
					}) : null,
					topInter ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "flex min-h-11 w-full flex-col gap-0.5 rounded-sm px-1 py-1.5 text-left hover:bg-hover",
						onClick: () => openPair(topInter.o, topInter.d),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted",
								children: "Busiest O/D pair"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-sm text-fg",
								children: [
									regionLabel(regions[topInter.o], labelMode),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "mx-1.5 text-subtle",
										children: "→"
									}),
									regionLabel(regions[topInter.d], labelMode)
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "tabular text-xs text-accent",
								children: fmtPct(flowValue(topInter, tripTypes))
							})
						]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "grid grid-cols-1 gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
						title: "Start hour",
						histogram: analysis.histograms.hours
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
						title: "Trip length",
						histogram: analysis.histograms.length,
						maxBars: 16
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
						title: "Duration",
						histogram: analysis.histograms.duration,
						maxBars: 14
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
						title: "Average speed",
						histogram: analysis.histograms.speed,
						maxBars: 14
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-2 flex flex-wrap items-center justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-xs font-medium tracking-wide text-muted uppercase",
						children: "Ranking"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex rounded-sm border border-border p-0.5",
						children: [
							"touch",
							"origin",
							"dest",
							"via"
						].map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setMetric(m),
							className: `h-9 rounded-xs px-2 text-xs ${metric === m ? "bg-raised text-fg" : "text-muted"}`,
							children: m === "dest" ? "Dest" : m[0].toUpperCase() + m.slice(1)
						}, m))
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: search,
					onChange: (e) => setSearch(e.target.value),
					placeholder: "Search districts",
					className: "mb-2 h-10"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "flex flex-col",
					children: ranked.slice(0, 16).map((r, i) => {
						const v = aggMetric(agg, r, metric);
						const color = HEAT[binIndex(v, breaks)] ?? HEAT[0];
						const active = selectedId === r.id;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setSelected(r.id),
							className: `flex min-h-11 w-full items-center gap-2 rounded-sm px-1 py-1.5 text-left ${active ? "bg-hover" : "hover:bg-hover"}`,
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular w-5 text-xs text-subtle",
									children: i + 1
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "size-2.5 shrink-0 rounded-xs",
									style: { background: color }
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "min-w-0 flex-1 truncate text-sm",
									dir: "auto",
									children: regionLabel(r, labelMode)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular text-xs text-muted",
									children: fmtPct(v)
								})
							]
						}) }, r.id);
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-2 text-xs text-subtle",
					children: [
						"Click a region to inspect it. ",
						regions.length,
						" districts · TomTom Move · ",
						meta.mapType,
						" ",
						meta.mapVersion,
						"."
					]
				})
			] }),
			selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RegionDetail, {
				region: selected,
				analysis
			}) : null
		]
	});
}
function Stat({ label, value, hint }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "rounded-md border border-border bg-raised p-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted",
				children: label
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "tabular mt-1 text-lg font-medium tracking-tight",
				children: value
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-1 text-xs text-subtle",
				children: hint
			})
		]
	});
}
function InsightRow({ icon, label, region, value, mode, onClick }) {
	if (!region) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
		type: "button",
		onClick,
		className: "flex min-h-11 w-full items-start gap-2 rounded-sm px-1 py-1.5 text-left hover:bg-hover",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 text-accent",
				children: icon
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block text-xs text-muted",
					children: label
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate text-sm",
					dir: "auto",
					children: regionLabel(region, mode)
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "tabular shrink-0 text-xs text-accent",
				children: value
			})
		]
	});
}
function RegionDetail({ region, analysis }) {
	const labelMode = useOdStore((s) => s.labelMode);
	const openPair = useOdStore((s) => s.openPair);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const n = analysis.regions.length;
	const matrix = buildFilteredMatrix(analysis, tripTypes);
	const outgoing = analysis.regions.map((d) => ({
		d,
		v: matrix[region.id * n + d.id] ?? 0
	})).filter((x) => x.v > 0 && x.d.id !== region.id).sort((a, b) => b.v - a.v).slice(0, 6);
	const incoming = analysis.regions.map((o) => ({
		o,
		v: matrix[o.id * n + region.id] ?? 0
	})).filter((x) => x.v > 0 && x.o.id !== region.id).sort((a, b) => b.v - a.v).slice(0, 6);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "rounded-lg border border-border bg-raised p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "text-xs text-muted",
				children: "Region detail"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "mt-1 text-base font-medium",
				dir: "auto",
				children: regionLabel(region, labelMode)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-subtle",
				dir: "auto",
				children: labelMode === "en" ? region.name : region.en
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 grid grid-cols-2 gap-2 text-xs",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Origin ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular float-right text-fg",
						children: fmtPct(region.origin)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Dest ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular float-right text-fg",
						children: fmtPct(region.dest)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Via ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular float-right text-fg",
						children: fmtPct(region.via)
					})] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: ["Internal ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular float-right text-fg",
						children: fmtPct(region.internal)
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-4 grid grid-cols-2 gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-1 text-xs text-muted",
					children: "Top destinations"
				}), outgoing.map(({ d, v }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex min-h-9 w-full items-center justify-between gap-2 py-0.5 text-left text-xs hover:text-accent",
					onClick: () => openPair(region.id, d.id),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						dir: "auto",
						children: regionLabel(d, labelMode)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-muted",
						children: fmtPct(v)
					})]
				}, d.id))] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-1 text-xs text-muted",
					children: "Top origins"
				}), incoming.map(({ o, v }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "flex min-h-9 w-full items-center justify-between gap-2 py-0.5 text-left text-xs hover:text-accent",
					onClick: () => openPair(o.id, region.id),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						dir: "auto",
						children: regionLabel(o, labelMode)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-muted",
						children: fmtPct(v)
					})]
				}, o.id))] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
				size: "sm",
				variant: "secondary",
				className: "mt-3 w-full",
				onClick: () => openPair(region.id, outgoing[0]?.d.id ?? region.id),
				children: "Open in Flows Explorer"
			})
		]
	});
}
function MatrixView({ analysis }) {
	const labelMode = useOdStore((s) => s.labelMode);
	const matrixLimit = useOdStore((s) => s.matrixLimit);
	const setMatrixLimit = useOdStore((s) => s.setMatrixLimit);
	const search = useOdStore((s) => s.search);
	const setSearch = useOdStore((s) => s.setSearch);
	const openPair = useOdStore((s) => s.openPair);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const canvasRef = (0, import_react.useRef)(null);
	const wrapRef = (0, import_react.useRef)(null);
	const [hover, setHover] = (0, import_react.useState)(null);
	const matrix = (0, import_react.useMemo)(() => buildFilteredMatrix(analysis, tripTypes), [analysis, tripTypes]);
	const ids = (0, import_react.useMemo)(() => {
		const q = search.trim().toLowerCase();
		let list = [...analysis.regions].sort((a, b) => b.touch - a.touch);
		if (q) list = list.filter((r) => r.en.toLowerCase().includes(q) || r.name.includes(search.trim()));
		return list.slice(0, matrixLimit).map((r) => r.id);
	}, [
		analysis.regions,
		matrixLimit,
		search
	]);
	const nShow = ids.length;
	const cell = nShow > 60 ? 8 : nShow > 40 ? 12 : 16;
	const labelW = 118;
	const values = (0, import_react.useMemo)(() => {
		const out = [];
		const n = analysis.regions.length;
		for (const o of ids) for (const d of ids) out.push(matrix[o * n + d] ?? 0);
		return out;
	}, [
		matrix,
		analysis.regions.length,
		ids
	]);
	const breaks = (0, import_react.useMemo)(() => quantileBreaks(values, 6), [values]);
	(0, import_react.useEffect)(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const w = labelW + nShow * cell;
		const h = labelW + nShow * cell;
		canvas.width = w * dpr;
		canvas.height = h * dpr;
		canvas.style.width = `${w}px`;
		canvas.style.height = `${h}px`;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = "#0c0f14";
		ctx.fillRect(0, 0, w, h);
		const n = analysis.regions.length;
		for (let i = 0; i < nShow; i++) for (let j = 0; j < nShow; j++) {
			const o = ids[i];
			const d = ids[j];
			const v = matrix[o * n + d] ?? 0;
			ctx.fillStyle = v <= 0 ? "#151a22" : HEAT[binIndex(v, breaks)];
			ctx.fillRect(labelW + j * cell, labelW + i * cell, cell - .6, cell - .6);
		}
		ctx.fillStyle = "#8b939e";
		ctx.font = "10px IBM Plex Sans, sans-serif";
		ctx.textBaseline = "middle";
		for (let i = 0; i < nShow; i++) {
			const r = analysis.regions[ids[i]];
			const name = regionLabel(r, labelMode);
			ctx.save();
			ctx.translate(labelW + i * cell + cell / 2, 112);
			ctx.rotate(-Math.PI / 2);
			ctx.textAlign = "left";
			ctx.fillText(truncate(name, 16), 0, 0);
			ctx.restore();
			ctx.textAlign = "right";
			ctx.fillText(truncate(name, 16), 112, labelW + i * cell + cell / 2);
		}
	}, [
		analysis,
		ids,
		nShow,
		cell,
		labelW,
		labelMode,
		breaks,
		matrix
	]);
	function onMove(e) {
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const y = e.clientY - rect.top;
		const j = Math.floor((x - labelW) / cell);
		const i = Math.floor((y - labelW) / cell);
		if (i < 0 || j < 0 || i >= nShow || j >= nShow) {
			setHover(null);
			return;
		}
		const wrap = wrapRef.current;
		const left = wrap ? e.currentTarget.offsetLeft : 0;
		const top = wrap ? e.currentTarget.offsetTop : 0;
		setHover({
			o: ids[i],
			d: ids[j],
			x: left + x,
			y: top + y
		});
	}
	const hoverVal = hover != null ? matrix[hover.o * analysis.regions.length + hover.d] ?? 0 : 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full flex-col bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2 border-b border-border px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					value: search,
					onChange: (e) => setSearch(e.target.value),
					placeholder: "Filter regions",
					className: "h-10 max-w-xs"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex rounded-sm border border-border p-0.5",
					children: [
						24,
						40,
						60,
						analysis.regions.length
					].map((lim) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setMatrixLimit(lim),
						className: `h-9 rounded-xs px-2.5 text-xs ${matrixLimit === lim ? "bg-raised text-fg" : "text-muted"}`,
						children: lim === analysis.regions.length ? "All" : `Top ${lim}`
					}, lim))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-subtle",
					children: "Rows = origin · columns = destination · % of all trips"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "secondary",
					className: "ml-auto",
					onClick: () => exportCsv(analysis, ids, labelMode, matrix),
					children: "Export CSV"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: wrapRef,
			className: "relative min-h-0 flex-1 overflow-auto p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("canvas", {
				ref: canvasRef,
				onMouseMove: onMove,
				onMouseLeave: () => setHover(null),
				onClick: () => {
					if (hover) openPair(hover.o, hover.d);
				},
				className: "cursor-crosshair"
			}), hover ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "pointer-events-none absolute z-10 max-w-xs rounded-sm border border-border bg-raised px-3 py-2 text-xs shadow-lg",
				style: {
					left: hover.x + 16,
					top: hover.y + 16
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						dir: "auto",
						children: regionLabel(analysis.regions[hover.o], labelMode)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-subtle",
						children: "to"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						dir: "auto",
						children: regionLabel(analysis.regions[hover.d], labelMode)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "tabular mt-1 text-accent",
						children: fmtPct(hoverVal, 3)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "text-subtle",
						children: "Click to open in Flows Explorer"
					})
				]
			}) : null]
		})]
	});
}
function truncate(s, n) {
	return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
function exportCsv(analysis, ids, mode, matrix) {
	const n = analysis.regions.length;
	const names = ids.map((id) => regionLabel(analysis.regions[id], mode).replaceAll(",", " "));
	const lines = [",".concat(names.join(","))];
	for (let i = 0; i < ids.length; i++) {
		const row = [names[i]];
		for (let j = 0; j < ids.length; j++) row.push((matrix[ids[i] * n + ids[j]] ?? 0).toFixed(4));
		lines.push(row.join(","));
	}
	const blob = new Blob([lines.join("\n")], { type: "text/csv" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = "sharjah-od-matrix.csv";
	a.click();
	URL.revokeObjectURL(url);
}
function FlowsExplorer({ analysis }) {
	const [drawer, setDrawer] = (0, import_react.useState)(false);
	const origins = useOdStore((s) => s.origins);
	const dests = useOdStore((s) => s.dests);
	const vias = useOdStore((s) => s.vias);
	const toggleRole = useOdStore((s) => s.toggleRole);
	const search = useOdStore((s) => s.search);
	useOdStore((s) => s.setSearch);
	const selectedId = useOdStore((s) => s.selectedId);
	useOdStore((s) => s.setSelected);
	const labelMode = useOdStore((s) => s.labelMode);
	const minFlow = useOdStore((s) => s.minFlow);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const filtered = (0, import_react.useMemo)(() => {
		const q = search.trim().toLowerCase();
		let list = analysis.regions;
		if (q) list = list.filter((r) => r.en.toLowerCase().includes(q) || r.name.includes(search.trim()));
		return [...list].sort((a, b) => b.touch - a.touch).slice(0, 50);
	}, [analysis.regions, search]);
	const flows = (0, import_react.useMemo)(() => {
		const oSet = new Set(origins);
		const dSet = new Set(dests);
		const vSet = new Set(vias);
		const rows = [];
		for (const row of analysis.od) {
			const v = flowValue(row, tripTypes);
			if (v < minFlow) continue;
			if (row.o === row.d) continue;
			if (oSet.size && !oSet.has(row.o)) continue;
			if (dSet.size && !dSet.has(row.d)) continue;
			if (vSet.size) {
				const list = analysis.viaByPair.get(pairKey(row.o, row.d)) ?? [];
				const ids = new Set(list.map((x) => x.v));
				let ok = true;
				for (const vid of vSet) if (!ids.has(vid)) {
					ok = false;
					break;
				}
				if (!ok) continue;
			}
			rows.push({
				o: row.o,
				d: row.d,
				v
			});
		}
		return rows.sort((a, b) => b.v - a.v);
	}, [
		analysis.od,
		analysis.viaByPair,
		origins,
		dests,
		vias,
		minFlow,
		tripTypes
	]);
	const pairHours = (0, import_react.useMemo)(() => {
		if (origins.length === 1 && dests.length === 1) {
			const hs = analysis.hoursByPair.get(`${origins[0]},${dests[0]}`);
			if (hs) return {
				labels: Array.from({ length: 24 }, (_, i) => i),
				values: hs,
				unit: "h"
			};
		}
		if (origins.length === 1) {
			const acc = new Array(24).fill(0);
			for (const d of dests.length ? dests : analysis.regions.map((r) => r.id)) {
				const hs = analysis.hoursByPair.get(`${origins[0]},${d}`);
				if (!hs) continue;
				for (let i = 0; i < 24; i++) acc[i] += hs[i] ?? 0;
			}
			return {
				labels: Array.from({ length: 24 }, (_, i) => i),
				values: acc,
				unit: "h"
			};
		}
		return analysis.histograms.hours;
	}, [
		analysis,
		origins,
		dests
	]);
	const pairShare = (0, import_react.useMemo)(() => flows.reduce((s, f) => s + f.v, 0), [flows]);
	const viaForPair = (0, import_react.useMemo)(() => {
		if (origins.length !== 1 || dests.length !== 1) return [];
		return (analysis.viaByPair.get(`${origins[0]},${dests[0]}`) ?? []).slice().sort((a, b) => b.val - a.val).slice(0, 8);
	}, [
		analysis.viaByPair,
		origins,
		dests
	]);
	const pairRow = origins.length === 1 && dests.length === 1 ? analysis.od.find((r) => r.o === origins[0] && r.d === dests[0]) : void 0;
	const scenario = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScenarioPanel, {
		analysis,
		filtered,
		onClose: () => setDrawer(false)
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: "hidden w-80 shrink-0 flex-col border-r border-border bg-surface md:flex",
				children: scenario
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative min-h-52 flex-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OdMap, {
							analysis,
							flows
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "pointer-events-none absolute top-3 left-3 z-10 rounded-md border border-border bg-surface/90 px-3 py-2 text-xs backdrop-blur-sm",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted",
									children: [flows.length, " flows"]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular mx-2 text-fg",
									children: fmtPct(pairShare)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-subtle",
									children: "of all trips"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "absolute top-3 right-3 z-10 flex h-10 items-center gap-1.5 rounded-sm border border-border bg-surface px-3 text-xs text-fg md:hidden",
							onClick: () => setDrawer(true),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SlidersHorizontal, { className: "size-3.5" }), "Scenario"]
						}),
						selectedId != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "absolute bottom-3 left-3 z-10 flex flex-wrap gap-1 rounded-md border border-border bg-surface/95 p-2 backdrop-blur-sm md:hidden",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mr-1 max-w-36 truncate self-center text-xs",
									dir: "auto",
									children: regionLabel(analysis.regions[selectedId], labelMode)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "origin",
									onClick: () => toggleRole(selectedId, "origin"),
									children: "Origin"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "dest",
									onClick: () => toggleRole(selectedId, "dest"),
									children: "Dest"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "via",
									onClick: () => toggleRole(selectedId, "via"),
									children: "Via"
								})
							]
						}) : null
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid max-h-[46%] grid-cols-1 gap-3 overflow-y-auto border-t border-border bg-bg p-3 md:grid-cols-2 xl:grid-cols-4",
					children: [
						pairRow ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-border bg-surface p-3 md:col-span-2 xl:col-span-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mb-2 text-xs font-medium tracking-wide text-muted uppercase",
								children: "Pair mix"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TypeMixBar, {
								contained: pairRow.types[0],
								inbound: pairRow.types[1],
								outbound: pairRow.types[2],
								through: pairRow.types[3]
							})]
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
							title: "Start hour",
							histogram: pairHours
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
							title: "Trip length",
							histogram: analysis.histograms.length,
							maxBars: 20
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
							title: "Duration",
							histogram: analysis.histograms.duration,
							maxBars: 18
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiniHistogram, {
							title: "Average speed",
							histogram: analysis.histograms.speed,
							maxBars: 18
						}),
						viaForPair.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "rounded-md border border-border bg-surface p-3 md:col-span-2 xl:col-span-4",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mb-2 text-xs font-medium tracking-wide text-muted uppercase",
								children: "Via regions on this pair"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "flex flex-wrap gap-2",
								children: viaForPair.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: () => toggleRole(row.v, "via"),
									className: "h-9 rounded-sm border border-border bg-raised px-2 text-xs hover:bg-hover",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										dir: "auto",
										children: regionLabel(analysis.regions[row.v], labelMode)
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "tabular ml-2 text-accent",
										children: fmtPct(row.val)
									})]
								}, row.v))
							})]
						}) : null
					]
				})]
			}),
			drawer ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-0 z-50 md:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					className: "absolute inset-0 bg-bg/60",
					"aria-label": "Close scenario",
					onClick: () => setDrawer(false)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "absolute inset-x-0 bottom-0 flex h-[min(88svh,720px)] flex-col rounded-t-xl border border-border bg-surface",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-h-0 flex-1 overflow-hidden",
						children: scenario
					})]
				})]
			}) : null
		]
	});
}
function ScenarioPanel({ analysis, filtered, onClose }) {
	const origins = useOdStore((s) => s.origins);
	const dests = useOdStore((s) => s.dests);
	const vias = useOdStore((s) => s.vias);
	const toggleRole = useOdStore((s) => s.toggleRole);
	const clearRoles = useOdStore((s) => s.clearRoles);
	const search = useOdStore((s) => s.search);
	const setSearch = useOdStore((s) => s.setSearch);
	const selectedId = useOdStore((s) => s.selectedId);
	const setSelected = useOdStore((s) => s.setSelected);
	const labelMode = useOdStore((s) => s.labelMode);
	const minFlow = useOdStore((s) => s.minFlow);
	const setMinFlow = useOdStore((s) => s.setMinFlow);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-xs font-medium tracking-wide text-muted uppercase",
							children: "Scenario"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: clearRoles,
								children: "Reset"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "icon-sm",
								variant: "ghost",
								className: "md:hidden",
								onClick: onClose,
								"aria-label": "Close",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-4" })
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleGroup, {
						title: "Origins",
						ids: origins,
						analysis,
						onRemove: (id) => toggleRole(id, "origin")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleGroup, {
						title: "Destinations",
						ids: dests,
						analysis,
						onRemove: (id) => toggleRole(id, "dest")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RoleGroup, {
						title: "Via",
						ids: vias,
						analysis,
						onRemove: (id) => toggleRole(id, "via")
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs text-subtle",
						children: "Mark districts as origin, destination, or via. Via keeps only trips that passed through every selected waypoint. Click the map to assign origin, then destination."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
						className: "mt-3 block text-xs text-muted",
						children: [
							"Minimum flow ",
							fmtPct(minFlow, 2),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "range",
								min: .02,
								max: 1,
								step: .02,
								value: minFlow,
								onChange: (e) => setMinFlow(Number(e.target.value)),
								className: "mt-1 w-full accent-accent"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-h-0 flex-1 overflow-y-auto p-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: search,
						onChange: (e) => setSearch(e.target.value),
						placeholder: "Search districts",
						className: "mb-2 h-10"
					}),
					selectedId != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3 rounded-md border border-border bg-raised p-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-xs text-muted",
								children: "Selected"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "truncate text-sm",
								dir: "auto",
								children: regionLabel(analysis.regions[selectedId], labelMode)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex gap-1",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "origin",
										onClick: () => toggleRole(selectedId, "origin"),
										children: "Origin"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "dest",
										onClick: () => toggleRole(selectedId, "dest"),
										children: "Dest"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										variant: "via",
										onClick: () => toggleRole(selectedId, "via"),
										children: "Via"
									})
								]
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: filtered.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setSelected(r.id),
						className: `flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-hover ${selectedId === r.id ? "bg-hover" : ""}`,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "truncate",
							dir: "auto",
							children: regionLabel(r, labelMode)
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "tabular text-xs text-subtle",
							children: fmtPct(r.touch)
						})]
					}) }, r.id)) })
				]
			})
		]
	});
}
function RoleGroup({ title, ids, analysis, onRemove }) {
	const labelMode = useOdStore((s) => s.labelMode);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mt-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-1 text-xs text-muted",
			children: title
		}), ids.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-xs text-subtle",
			children: "None — select a district on the map or list"
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-wrap gap-1",
			children: ids.map((id) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "inline-flex h-8 items-center gap-1 rounded-full border border-border bg-raised px-2 text-xs",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					dir: "auto",
					className: "max-w-36 truncate",
					children: regionLabel(analysis.regions[id], labelMode)
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => onRemove(id),
					className: "text-subtle hover:text-fg",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-3" })
				})]
			}, id))
		})]
	});
}
function SankeyView({ analysis }) {
	const labelMode = useOdStore((s) => s.labelMode);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const sankeyLimit = useOdStore((s) => s.sankeyLimit);
	const setSankeyLimit = useOdStore((s) => s.setSankeyLimit);
	const openPair = useOdStore((s) => s.openPair);
	const data = (0, import_react.useMemo)(() => buildSankey(analysis, tripTypes, sankeyLimit, labelMode), [
		analysis,
		tripTypes,
		sankeyLimit,
		labelMode
	]);
	const layout = (0, import_react.useMemo)(() => layoutSankey(data), [data]);
	const total = data.links.reduce((s, l) => s + l.value, 0);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col bg-bg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-wrap items-center gap-2 border-b border-border px-4 py-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Origins left · destinations right · width is share of all trips"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex rounded-sm border border-border p-0.5",
					children: [
						6,
						8,
						10,
						12
					].map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setSankeyLimit(n),
						className: `h-9 rounded-xs px-3 text-xs ${sankeyLimit === n ? "bg-raised text-fg" : "text-muted hover:text-fg"}`,
						children: ["Top ", n]
					}, n))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "tabular ml-auto text-xs text-subtle",
					children: [fmtPct(total), " in view"]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-0 flex-1 overflow-auto p-3",
			children: data.links.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex h-full min-h-64 items-center justify-center text-sm text-muted",
				children: "No flows above the floor for this filter."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
				viewBox: `0 0 ${layout.width} ${layout.height}`,
				className: "mx-auto h-full w-full max-w-6xl",
				role: "img",
				"aria-label": "Origin destination sankey",
				children: [layout.links.map((l) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: l.dPath,
					fill: "none",
					stroke: "#3d8aa0",
					strokeOpacity: .38,
					strokeWidth: l.thickness,
					className: "cursor-pointer hover:stroke-accent",
					onClick: () => openPair(l.o, l.d),
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("title", { children: [
						regionLabel(analysis.regions[l.o], labelMode),
						" →",
						" ",
						regionLabel(analysis.regions[l.d], labelMode),
						" ",
						fmtPct(l.value, 3)
					] })
				}, `${l.o}-${l.d}`)), layout.nodes.map((n) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
					x: n.x,
					y: n.y,
					width: n.w,
					height: n.h,
					rx: 2,
					fill: n.side === "origin" ? "#7ea8c4" : "#d6c4a8"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: n.side === "origin" ? n.x - 8 : n.x + n.w + 8,
					y: n.y + n.h / 2,
					textAnchor: n.side === "origin" ? "end" : "start",
					dominantBaseline: "middle",
					fill: "#e8eaed",
					fontSize: 12,
					children: n.name.slice(0, 22)
				})] }, `${n.side}-${n.id}`))]
			})
		})]
	});
}
function layoutSankey(data) {
	const width = 1100;
	const height = Math.max(520, data.originCount * 52);
	const nodeW = 12;
	const leftX = 160;
	const rightX = 928;
	const pad = 10;
	const origins = data.nodes.filter((n) => n.side === "origin");
	const dests = data.nodes.filter((n) => n.side === "dest");
	const originOut = /* @__PURE__ */ new Map();
	const destIn = /* @__PURE__ */ new Map();
	for (const l of data.links) {
		originOut.set(l.o, (originOut.get(l.o) ?? 0) + l.value);
		destIn.set(l.d, (destIn.get(l.d) ?? 0) + l.value);
	}
	function stack(list, values, x) {
		const totals = list.map((n) => Math.max(values.get(n.id) ?? .04, .04));
		const sum = totals.reduce((a, b) => a + b, 0) || 1;
		const usable = height - 20 - (list.length - 1) * 8;
		let y = pad;
		return list.map((n, i) => {
			const h = Math.max(10, totals[i] / sum * usable);
			const node = {
				id: n.id,
				name: n.name,
				side: n.side,
				x,
				y,
				w: nodeW,
				h
			};
			y += h + 8;
			return node;
		});
	}
	const left = stack(origins, originOut, leftX);
	const right = stack(dests, destIn, rightX);
	const leftBy = new Map(left.map((n) => [n.id, n]));
	const rightBy = new Map(right.map((n) => [n.id, n]));
	const leftCursor = new Map(left.map((n) => [n.id, n.y]));
	const rightCursor = new Map(right.map((n) => [n.id, n.y]));
	const maxV = Math.max(...data.links.map((l) => l.value), .001);
	const links = data.links.map((l) => {
		const a = leftBy.get(l.o);
		const b = rightBy.get(l.d);
		const thickness = Math.max(2, l.value / maxV * Math.min(a.h, 28));
		const y1 = leftCursor.get(l.o) + thickness / 2;
		const y2 = rightCursor.get(l.d) + thickness / 2;
		leftCursor.set(l.o, leftCursor.get(l.o) + thickness);
		rightCursor.set(l.d, rightCursor.get(l.d) + thickness);
		const x1 = a.x + a.w;
		const x2 = b.x;
		const mid = (x1 + x2) / 2;
		const dPath = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
		return {
			o: l.o,
			d: l.d,
			value: l.value,
			thickness,
			dPath
		};
	});
	return {
		width,
		height,
		nodes: [...left, ...right],
		links
	};
}
function HeatLegend({ breaks, title }) {
	const edges = [0, ...breaks];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "pointer-events-none absolute right-3 bottom-10 z-10 w-44 rounded-md border border-border bg-surface/90 p-3 backdrop-blur-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-2 text-xs font-medium tracking-wide text-muted uppercase",
			children: title
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col gap-1",
			children: HEAT.map((c, i) => {
				const lo = edges[i] ?? 0;
				const hi = edges[i + 1];
				const label = hi == null ? `${fmtPct(lo, 2)}+` : `${fmtPct(lo, 2)} – ${fmtPct(hi, 2)}`;
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "size-3 shrink-0 rounded-xs",
						style: { background: `var(--color-heat-${i})` }
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "tabular text-xs text-muted",
						children: label
					})]
				}, c);
			})
		})]
	});
}
var VIEWS = [
	{
		id: "overview",
		label: "Overview",
		icon: Map$1
	},
	{
		id: "matrix",
		label: "Matrix",
		icon: LayoutGrid
	},
	{
		id: "sankey",
		label: "Sankey",
		icon: GitFork
	},
	{
		id: "flows",
		label: "Flows",
		icon: Waypoints
	}
];
function OdShell() {
	const [analysis, setAnalysis] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const view = useOdStore((s) => s.view);
	const setView = useOdStore((s) => s.setView);
	const metric = useOdStore((s) => s.metric);
	const labelMode = useOdStore((s) => s.labelMode);
	const setLabelMode = useOdStore((s) => s.setLabelMode);
	const tripTypes = useOdStore((s) => s.tripTypes);
	const showArcs = useOdStore((s) => s.showArcs);
	const setShowArcs = useOdStore((s) => s.setShowArcs);
	(0, import_react.useEffect)(() => {
		loadAnalysis().then(setAnalysis).catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
	}, []);
	const overviewFlows = (0, import_react.useMemo)(() => {
		if (!analysis) return [];
		return analysis.od.filter((r) => r.o !== r.d).map((r) => ({
			o: r.o,
			d: r.d,
			v: flowValue(r, tripTypes)
		})).filter((r) => r.v >= .28);
	}, [analysis, tripTypes]);
	const breaks = (0, import_react.useMemo)(() => {
		if (!analysis) return [];
		const agg = aggregateRegions(analysis, tripTypes);
		return quantileBreaks(analysis.regions.map((r) => aggMetric(agg, r, metric)));
	}, [
		analysis,
		metric,
		tripTypes
	]);
	if (error) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex min-h-svh items-center justify-center bg-bg p-6 text-center",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
			className: "text-lg font-medium",
			children: "Sharjah Origins"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-sm text-muted",
			children: error
		})] })
	});
	if (!analysis) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-svh flex-col bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "border-b border-border px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
				className: "text-sm font-semibold tracking-tight",
				children: "Sharjah Origins"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: "Origin–destination analysis · 176 districts · 5–11 Jul 2026"
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid flex-1 grid-cols-1 md:grid-cols-[1fr_380px]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex items-center justify-center",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Loading Sharjah analysis…"
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				className: "hidden border-l border-border p-4 md:block",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid grid-cols-2 gap-2",
					children: Array.from({ length: 6 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-20 rounded-md border border-border bg-raised" }, i))
				})
			})]
		})]
	});
	const { meta } = analysis;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-svh flex-col bg-bg text-fg",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2 sm:px-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0 flex-1",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-sm font-semibold tracking-tight",
								children: "Sharjah Origins"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "hidden text-xs text-subtle sm:inline",
								children: "O/D Analysis"
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "truncate text-xs text-muted",
							children: [
								formatDate(meta.startDate),
								" — ",
								formatDate(meta.endDate),
								" · ",
								meta.timeRange,
								" · ",
								meta.zoneId,
								" ·",
								" ",
								meta.regionCount,
								" districts"
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex rounded-sm border border-border p-0.5",
						"aria-label": "Visualizer",
						children: VIEWS.map((v) => {
							const Icon = v.icon;
							const active = view === v.id;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setView(v.id),
								className: `flex h-10 items-center gap-1.5 rounded-xs px-2.5 text-sm sm:px-3 ${active ? "bg-raised text-fg" : "text-muted hover:text-fg"}`,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, { className: "size-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "hidden sm:inline",
									children: v.label
								})]
							}, v.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "secondary",
						onClick: () => setLabelMode(labelMode === "en" ? "ar" : "en"),
						children: labelMode === "en" ? "AR" : "EN"
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TripTypeFilter, { compact: true }), view === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setShowArcs(!showArcs),
					className: `h-9 rounded-sm border px-2.5 text-xs ${showArcs ? "border-accent text-fg" : "border-border text-muted"}`,
					children: showArcs ? "Hide flows" : "Show flows"
				}) : null]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-0 flex-1 flex-col md:flex-row",
			children: [
				view === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative min-h-0 min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OdMap, {
						analysis,
						flows: overviewFlows
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeatLegend, {
						breaks,
						title: metricTitle(metric)
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
					className: "h-[44%] shrink-0 overflow-y-auto border-t border-border bg-surface md:h-auto md:w-[min(100%,400px)] md:border-t-0 md:border-l",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OverviewPanel, { analysis })
				})] }) : null,
				view === "matrix" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MatrixView, { analysis }) : null,
				view === "sankey" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SankeyView, { analysis }) : null,
				view === "flows" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FlowsExplorer, { analysis }) : null
			]
		})]
	});
}
function formatDate(iso) {
	const [y, m, d] = iso.split("-");
	return `${d}/${m}/${y}`;
}
function metricTitle(m) {
	if (m === "origin") return "% of trips as origin";
	if (m === "dest") return "% of trips as destination";
	if (m === "via") return "% of trips via region";
	return "% of trips touching region";
}
function Home() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OdShell, {});
}
//#endregion
export { Home as component };
