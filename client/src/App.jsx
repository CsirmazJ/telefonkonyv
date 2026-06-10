import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

// ─── API helper ───────────────────────────────────────────────────────────────
const call = async (url, method = "GET", body = null, token = null) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

// ─── Üres munkatárs sablon ────────────────────────────────────────────────────
const EMPTY_EMP = { name: "", position: "", phone: "", phone_2: "", email_1: "", email_2: "", email_3: "", unit_id: null, active: true };

// ─── Telefonszám formázó (Google-stílus: +36703631372) ────────────────────────
const fmtPhone = (p) => {
  if (!p) return "";
  const digits = p.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  return digits;
};

// ─── Színsémák ────────────────────────────────────────────────────────────────
const LIGHT = {
  pageBg:"#f8fafc",header:"#0d1b2e",headerBorder:"#1e3a5f",tabBar:"#162032",tabBorder:"#1e3a5f",
  tabText:"#7aa3cc",tabActive:"#ffffff",cardBg:"#ffffff",cardBg2:"#eef3fb",cardBorder:"#e2e8f0",
  cardFoot:"#fafbff",cardFootBorder:"#f1f5f9",thBg:"#0d1b2e",thText:"#7aa3cc",thBorder:"#1e3a5f",
  tdText:"#334155",tdTextMid:"#475569",tdTextLight:"#64748b",tdBorder:"#f1f5f9",
  rowOdd:"#fafbff",rowHover:"#eff6ff",rowArchived:"#fffbeb",text:"#0f172a",textMid:"#334155",
  textLight:"#64748b",textMuted:"#94a3b8",inputBg:"#ffffff",inputBorder:"#e2e8f0",inputText:"#1e293b",
  inputHeaderBg:"#162032",inputHeaderBorder:"#2a3f58",inputHeaderText:"#ffffff",toolbarBg:"#f1f5f9",
  segmentBg:"#f1f5f9",segmentActive:"#ffffff",blue:"#3b82f6",blueSoft:"#eff6ff",blueText:"#2563eb",
  amber:"#f59e0b",navy:"#0d1b2e",white:"#ffffff",red:"#ef4444",
  countBadgeBg:"rgba(59,130,246,0.15)",countBadgeText:"#93c5fd",
  countBadgeInactiveBg:"rgba(255,255,255,0.07)",countBadgeInactiveText:"#4a6380",
  overlayBg:"rgba(0,0,0,0.45)",modalBg:"#ffffff",cancelBg:"#f1f5f9",cancelText:"#475569",
  saveBg:"#0d1b2e",saveText:"#ffffff",avatarBg:"#eff6ff",avatarText:"#3b82f6",footText:"#94a3b8",
};
const DARK = {
  pageBg:"#0b1120",header:"#060d18",headerBorder:"#1a2d45",tabBar:"#0d1625",tabBorder:"#1a2d45",
  tabText:"#5a7fa0",tabActive:"#e2e8f0",cardBg:"#111d2e",cardBg2:"#0f1a28",cardBorder:"#1e3347",
  cardFoot:"#0f1a28",cardFootBorder:"#1e3347",thBg:"#080f1c",thText:"#5a7fa0",thBorder:"#1a2d45",
  tdText:"#cbd5e1",tdTextMid:"#94a3b8",tdTextLight:"#64748b",tdBorder:"#1a2d45",
  rowOdd:"#0f1a28",rowHover:"#162540",rowArchived:"#1c1a0e",text:"#f1f5f9",textMid:"#cbd5e1",
  textLight:"#94a3b8",textMuted:"#475569",inputBg:"#0b1422",inputBorder:"#1e3347",inputText:"#e2e8f0",
  inputHeaderBg:"#0d1625",inputHeaderBorder:"#1e3347",inputHeaderText:"#e2e8f0",toolbarBg:"#0d1625",
  segmentBg:"#0d1625",segmentActive:"#162032",blue:"#3b82f6",blueSoft:"#0f2040",blueText:"#60a5fa",
  amber:"#f59e0b",navy:"#060d18",white:"#f1f5f9",red:"#ef4444",
  countBadgeBg:"rgba(59,130,246,0.2)",countBadgeText:"#60a5fa",
  countBadgeInactiveBg:"rgba(255,255,255,0.05)",countBadgeInactiveText:"#3a5570",
  overlayBg:"rgba(0,0,0,0.65)",modalBg:"#111d2e",cancelBg:"#0d1625",cancelText:"#94a3b8",
  saveBg:"#1e3a5f",saveText:"#e2e8f0",avatarBg:"#0f2040",avatarText:"#60a5fa",footText:"#3a5570",
};

// ─── Fő komponens ─────────────────────────────────────────────────────────────
export default function PhoneBook() {
  const [units,      setUnits]      = useState([]);
  const [employees,  setEmployees]  = useState([]);
  const [users,      setUsers]      = useState([]);
  const [labels,     setLabels]     = useState({ title:"Telefonkönyv", employees:"Munkatársak", units:"Egységek" });
  const [labelDraft, setLabelDraft] = useState({ title:"Telefonkönyv", employees:"Munkatársak", units:"Egységek" });
  const [loading,    setLoading]    = useState(true);

  const [search,   setSearch]   = useState("");
  const [selUnit,  setSelUnit]  = useState(null);
  const [sortF,    setSortF]    = useState("name");
  const [sortD,    setSortD]    = useState("asc");
  const [dark,     setDark]     = useState(false);
  const [adminTab, setAdminTab] = useState("employees");

  const [currentUser, setCurrentUser] = useState(null);
  const [token,       setToken]       = useState(null);

  const [exportOpen,   setExportOpen]   = useState(false);
  const [exportModal,  setExportModal]  = useState(null);
  const [exportUnitId, setExportUnitId] = useState(null);

  const [loginOpen, setLoginOpen] = useState(false);
  const [loginUser, setLoginUser] = useState("");
  const [loginPw,   setLoginPw]   = useState("");
  const [loginErr,  setLoginErr]  = useState("");

  const [empModal,        setEmpModal]        = useState(null);
  const [unitModal,       setUnitModal]       = useState(null);
  const [userModal,       setUserModal]       = useState(null);
  const [deleteConfirm,   setDeleteConfirm]   = useState(null);
  const [deleteUnitConfirm, setDeleteUnitConfirm] = useState(null);
  const [importModal,     setImportModal]     = useState(null); // null | { rows, warnings, errors }
  const [importing,       setImporting]       = useState(false);
  const [toast,           setToast]           = useState(null);
  const [auditLog,        setAuditLog]        = useState([]);
  const [copiedKey,       setCopiedKey]       = useState(null);
  const [selectedIds,     setSelectedIds]     = useState(new Set());
  const [bulkUnit,        setBulkUnit]        = useState("");
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const importInputRef = useRef(null);

  const showToast = (message, type="success") => {
    setToast({message,type});
    setTimeout(()=>setToast(null), 3500);
  };

  const C          = dark ? DARK : LIGHT;
  const isAdmin    = currentUser !== null;
  const isSuperAdmin = currentUser?.role === "superadmin";

  // ── Adatok betöltése ─────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [emps, unitsData, cfg] = await Promise.all([
          call("/api/employees"),
          call("/api/units"),
          call("/api/settings"),
        ]);
        setEmployees(emps);
        setUnits(unitsData);
        const l = { title: cfg.title||"Telefonkönyv", employees: cfg.employees||"Munkatársak", units: cfg.units||"Egységek" };
        setLabels(l);
        setLabelDraft(l);
      } catch (e) {
        console.error("Betöltési hiba:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!token) { setUsers([]); setAuditLog([]); return; }
    call("/api/users", "GET", null, token).then(setUsers).catch(console.error);
  }, [token]);

  useEffect(() => {
    if (!token || currentUser?.role !== "superadmin") return;
    call("/api/audit", "GET", null, token).then(setAuditLog).catch(console.error);
  }, [token, currentUser, adminTab]);

  useEffect(() => { setSelectedIds(new Set()); }, [selUnit, search]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (bulkDeleteConfirm) { setBulkDeleteConfirm(false); return; }
      if (deleteConfirm)     { setDeleteConfirm(null);     return; }
      if (deleteUnitConfirm) { setDeleteUnitConfirm(null); return; }
      if (importModal)       { setImportModal(null);       return; }
      if (empModal)          { setEmpModal(null);          return; }
      if (unitModal)         { setUnitModal(null);         return; }
      if (userModal)         { setUserModal(null);         return; }
      if (exportModal)       { setExportModal(null);       return; }
      if (loginOpen)         { setLoginOpen(false);        return; }
      if (exportOpen)        { setExportOpen(false);       return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bulkDeleteConfirm, deleteConfirm, deleteUnitConfirm, importModal, empModal,
      unitModal, userModal, exportModal, loginOpen, exportOpen]);

  // ── Segédfüggvények ──────────────────────────────────────────────────────────
  const uName    = useCallback((uid) => uid == null ? "Nincs" : (units.find(u => u.id===uid)?.name||"–"), [units]);
  const empCount = (uid) => uid==="unassigned"
    ? employees.filter(e=>e.unit_id==null&&(isAdmin||e.active)).length
    : employees.filter(e=>e.unit_id===uid&&(isAdmin||e.active)).length;

  const filtered = useMemo(() => {
    let list = isAdmin ? employees : employees.filter(e => e.active);
    if (selUnit==="unassigned") list = list.filter(e => e.unit_id==null);
    else if (selUnit) list = list.filter(e => e.unit_id===selUnit);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter(e =>
      e.name.toLowerCase().includes(q) || e.position.toLowerCase().includes(q) ||
      e.phone.replace(/\s/g,"").includes(q.replace(/\s/g,"")) ||
      (e.phone_2||"").replace(/\s/g,"").includes(q.replace(/\s/g,"")) ||
      [e.email_1,e.email_2,e.email_3].some(em=>em.toLowerCase().includes(q))
    );
    return [...list].sort((a,b)=>{
      const av = sortF==="unit" ? uName(a.unit_id) : (a[sortF]||"");
      const bv = sortF==="unit" ? uName(b.unit_id) : (b[sortF]||"");
      return sortD==="asc" ? av.localeCompare(bv,"hu") : bv.localeCompare(av,"hu");
    });
  }, [employees, units, labels, search, selUnit, sortF, sortD, isAdmin, uName]);

  const handleSort = (f) => { if(sortF===f) setSortD(d=>d==="asc"?"desc":"asc"); else{setSortF(f);setSortD("asc");} };
  const sortIcon = (f) => sortF!==f ? <span style={{opacity:0.2,fontSize:"9px"}}>▲▼</span> : <span style={{fontSize:"9px",color:"#60a5fa"}}>{sortD==="asc"?"▲":"▼"}</span>;

  // ── Auth ─────────────────────────────────────────────────────────────────────
  const login = async () => {
    try {
      const data = await call("/api/auth/login","POST",{username:loginUser.trim(),password:loginPw});
      setCurrentUser(data.user); setToken(data.token);
      setLoginOpen(false); setLoginUser(""); setLoginPw(""); setLoginErr("");
    } catch(e) { setLoginErr(e.message); }
  };
  const logout = async () => {
    try { await call("/api/auth/logout", "POST", null, token); } catch {}
    setCurrentUser(null); setToken(null); setAdminTab("employees");
  };

  // ── CRUD: Munkatársak ────────────────────────────────────────────────────────
  const saveEmp = async (emp) => {
    try {
      if (emp.id) {
        const u = await call(`/api/employees/${emp.id}`,"PUT",emp,token);
        setEmployees(p=>p.map(e=>e.id===u.id?u:e));
        showToast(`${emp.name} adatai frissítve`);
      } else {
        const n = await call("/api/employees","POST",emp,token);
        setEmployees(p=>[...p,n]);
        showToast(`${n.name} hozzáadva`);
      }
      setEmpModal(null);
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  const toggleActive = async (id) => {
    const emp = employees.find(e=>e.id===id);
    if (!emp) return;
    try {
      const u = await call(`/api/employees/${id}`,"PUT",{...emp,active:!emp.active},token);
      setEmployees(p=>p.map(e=>e.id===id?u:e));
      showToast(emp.active ? `${emp.name} archiválva` : `${emp.name} visszaállítva`);
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  const deleteEmployee = async (id) => {
    try {
      await call(`/api/employees/${id}`,"DELETE",null,token);
      setEmployees(p=>p.filter(e=>e.id!==id));
      setDeleteConfirm(null);
      showToast("Munkatárs törölve");
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  // ── CRUD: Egységek ───────────────────────────────────────────────────────────
  const saveUnit = async (unit) => {
    try {
      if (unit.id) {
        const u = await call(`/api/units/${unit.id}`,"PUT",unit,token);
        setUnits(p=>p.map(x=>x.id===u.id?u:x));
        showToast(`${unit.name} átnevezve`);
      } else {
        const n = await call("/api/units","POST",unit,token);
        setUnits(p=>[...p,n]);
        showToast(`${n.name} egység létrehozva`);
      }
      setUnitModal(null);
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  const deleteUnit = async (id) => {
    try {
      await call(`/api/units/${id}`,"DELETE",null,token);
      setUnits(p=>p.filter(u=>u.id!==id));
      setEmployees(p=>p.map(e=>e.unit_id===id?{...e,unit_id:null}:e));
      setDeleteUnitConfirm(null);
      showToast("Egység törölve");
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  const moveUnit = async (id, direction) => {
    try {
      const updated = await call("/api/units/reorder","POST",{id,direction},token);
      setUnits(updated);
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  // ── CRUD: Felhasználók ───────────────────────────────────────────────────────
  const saveUser = async (user) => {
    try {
      if (user.id) {
        const u = await call(`/api/users/${user.id}`,"PUT",user,token);
        setUsers(p=>p.map(x=>x.id===u.id?u:x));
        if (currentUser?.id===user.id) setCurrentUser(c=>({...c,...u}));
      } else {
        const n = await call("/api/users","POST",user,token);
        setUsers(p=>[...p,n]);
      }
      setUserModal(null);
      showToast("Felhasználó mentve");
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  const deleteUser = async (id) => {
    try {
      await call(`/api/users/${id}`,"DELETE",null,token);
      setUsers(p=>p.filter(u=>u.id!==id));
    } catch(e) { showToast("Hiba: "+e.message,"error"); }
  };

  // ── Export ───────────────────────────────────────────────────────────────────
  const openExportModal = (type) => {
    setExportModal(type); setExportUnitId(typeof selUnit==="number"?selUnit:units[0]?.id||null); setExportOpen(false);
  };

  const doXLSX = (list) => {
    const uLabel = labels.units;
    const uId = list.length>0&&list.every(e=>e.unit_id===list[0].unit_id) ? uName(list[0].unit_id) : "osszes";
    const data = list.map(e=>({ "Név":e.name,"Beosztás":e.position,"Telefon":e.phone,"Telefon 2":e.phone_2,"Email 1":e.email_1,"Email 2":e.email_2,"Email 3":e.email_3,[uLabel]:uName(e.unit_id) }));
    const ws=XLSX.utils.json_to_sheet(data); ws["!cols"]=[{wch:22},{wch:26},{wch:18},{wch:18},{wch:30},{wch:30},{wch:30},{wch:14}];
    const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,labels.title);
    XLSX.writeFile(wb,`telefonkonyv_${uId}.xlsx`);
  };

  const doGoogleCSV = (list) => {
    const uId = list.length>0&&list.every(e=>e.unit_id===list[0].unit_id) ? uName(list[0].unit_id) : "osszes";
    const hasEmail2 = list.some(e=>e.email_2);
    const hasEmail3 = list.some(e=>e.email_3);
    const hasPhone2 = list.some(e=>e.phone_2);
    const headers = [
      "First Name","Middle Name","Last Name",
      "Phonetic First Name","Phonetic Middle Name","Phonetic Last Name",
      "Name Prefix","Name Suffix","Nickname","File As",
      "Organization Name","Organization Title","Organization Department",
      "Birthday","Notes","Photo","Labels",
      "E-mail 1 - Label","E-mail 1 - Value",
      ...(hasEmail2?["E-mail 2 - Label","E-mail 2 - Value"]:[]),
      ...(hasEmail3?["E-mail 3 - Label","E-mail 3 - Value"]:[]),
      "Phone 1 - Label","Phone 1 - Value",
      ...(hasPhone2?["Phone 2 - Label","Phone 2 - Value"]:[]),
    ];
    const rows = list.map(e => {
      const parts = e.name.trim().split(/\s+/);
      const lastName  = parts[0]||"";
      const firstName = parts.slice(1).join(" ");
      return [
        firstName,"",lastName,
        "","","","","","","",
        "", e.position, "",
        "","","", "",
        "*", e.email_1,
        ...(hasEmail2?["*",e.email_2]:[]),
        ...(hasEmail3?["*",e.email_3]:[]),
        "Mobile", e.phone,
        ...(hasPhone2?["Work",e.phone_2||""]:[]),
      ];
    });
    const esc = v => `"${(v||"").replace(/"/g,'""')}"`;
    const csv = [headers,...rows].map(r=>r.map(esc).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href=url; a.download=`google_contacts_${uId}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  const handleExport = (type, scope, unitId) => {
    const list =
      scope==="all"      ? employees.filter(e=>e.active) :
      scope==="filtered" ? filtered.filter(e=>e.active)  :
                           employees.filter(e=>e.active&&e.unit_id===unitId);
    if (type==="xlsx") doXLSX(list); else doGoogleCSV(list);
    setExportModal(null);
  };

  // ── Google CSV Import ────────────────────────────────────────────────────────
  const parseCSV = (text) => {
    const rows = []; let row = [], field = "", inQ = false;
    const clean = text.replace(/\uFEFF/,"").replace(/\r\n/g,"\n").replace(/\r/g,"\n");
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (inQ) {
        if (c==='"' && clean[i+1]==='"') { field+='"'; i++; }
        else if (c==='"') inQ=false;
        else field+=c;
      } else {
        if (c==='"') inQ=true;
        else if (c===',') { row.push(field); field=""; }
        else if (c==='\n') { row.push(field); field=""; if(row.some(Boolean)) rows.push(row); row=[]; }
        else field+=c;
      }
    }
    if (field||row.length) { row.push(field); if(row.some(Boolean)) rows.push(row); }
    return rows;
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCSV(ev.target.result);
        if (rows.length < 2) { showToast("A fájl üres vagy nem olvasható.","error"); return; }
        const hdrs = rows[0].map(h=>h.trim());
        const col = (name) => hdrs.indexOf(name);
        const hasFirst = col("First Name")>=0;
        const hasLast  = col("Last Name")>=0;
        const hasName  = col("Name")>=0;
        if (!hasFirst && !hasLast && !hasName) {
          showToast("Nem ismert CSV formátum. Exportálj Google Névjegyek > Névjegyek > Összes névjegy menüből.","error");
          return;
        }
        const existingEmails = new Set(employees.map(e=>e.email_1).filter(Boolean).map(s=>s.trim().toLowerCase()));
        const warnings = [], errors = [], parsed = [];
        rows.slice(1).forEach((r, idx) => {
          const get = (name) => (r[col(name)]||"").trim();
          let name = "";
          if (hasFirst||hasLast) {
            const fn = get("First Name"), ln = get("Last Name");
            name = ln&&fn ? `${ln} ${fn}` : (ln||fn);
          } else {
            name = get("Name");
          }
          if (!name) return;
          const labelsVal = get("Labels");
          const deptFromLabels = labelsVal.includes(":::") ? labelsVal.split(":::")[0].trim() : "";
          const deptFromOrg = get("Organization Department");
          const deptRaw = deptFromLabels || deptFromOrg;
          let unit_id = null;
          if (deptRaw) {
            const match = units.find(u=>u.name.toLowerCase()===deptRaw.toLowerCase());
            if (match) unit_id = match.id;
            else warnings.push(`${name}: ismeretlen egység – "${deptRaw}" (egység nélkül kerül be)`);
          }
          const email1 = get("E-mail 1 - Value");
          if (email1 && existingEmails.has(email1.toLowerCase())) {
            warnings.push(`${name}: az email (${email1}) már szerepel a rendszerben`);
          }
          parsed.push({
            name, active:true, unit_id,
            position: get("Organization Title"),
            phone:    get("Phone 1 - Value"),
            phone_2:  get("Phone 2 - Value"),
            email_1:  email1,
            email_2:  get("E-mail 2 - Value"),
            email_3:  get("E-mail 3 - Value"),
            _dept:    deptRaw,
          });
        });
        if (!parsed.length) { showToast("Nem található importálható névjegy a fájlban.","error"); return; }
        setImportModal({ rows: parsed, warnings, errors });
      } catch(err) { showToast("Hiba a fájl olvasásakor: "+err.message,"error"); }
      e.target.value = "";
    };
    reader.readAsText(file, "UTF-8");
  };

  const doImport = async () => {
    if (!importModal?.rows?.length) return;
    setImporting(true);
    let ok=0, fail=0;
    for (const emp of importModal.rows) {
      const { _dept, ...data } = emp;
      try { const n = await call("/api/employees","POST",data,token); setEmployees(p=>[...p,n]); ok++; }
      catch { fail++; }
    }
    setImporting(false);
    setImportModal(null);
    showToast(
      fail>0 ? `${ok} munkatárs importálva, ${fail} hiba` : `${ok} munkatárs sikeresen importálva`,
      fail>0 ? "error" : "success"
    );
  };

  // ── Beállítások mentése ──────────────────────────────────────────────────────
  const saveLabels = async () => {
    try {
      await call("/api/settings","PUT",labelDraft,token);
      setLabels({...labelDraft});
      showToast("Beállítások mentve");
    } catch(e) { showToast("Mentési hiba: "+e.message,"error"); }
  };

  // ── vCard letöltés ───────────────────────────────────────────────────────────
  const downloadVCard = (emp) => {
    const lastName  = emp.name.trim().split(/\s+/)[0] || "";
    const firstName = emp.name.trim().split(/\s+/).slice(1).join(" ");
    const orgName   = labels.title || "Vállalat";
    const unitName  = uName(emp.unit_id) || "";
    const lines = [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${emp.name}`, `N:${lastName};${firstName};;;`,
      emp.phone   ? `TEL;TYPE=CELL:${fmtPhone(emp.phone)}`   : "",
      emp.phone_2 ? `TEL;TYPE=WORK:${fmtPhone(emp.phone_2)}` : "",
      emp.email_1 ? `EMAIL;TYPE=WORK:${emp.email_1}` : "",
      emp.email_2 ? `EMAIL;TYPE=WORK:${emp.email_2}` : "",
      emp.email_3 ? `EMAIL;TYPE=WORK:${emp.email_3}` : "",
      emp.position ? `TITLE:${emp.position}` : "",
      `ORG:${orgName};${unitName}`,
      "END:VCARD",
    ].filter(Boolean).join("\r\n");
    const blob = new Blob([lines], { type:"text/vcard;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `${emp.name.replace(/\s+/g,"_")}.vcf`; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Vágólapra másolás gomb ────────────────────────────────────────────────────
  const copyBtn = (value, key) => {
    if (!value) return null;
    const copied = copiedKey === key;
    const doCopy = (e) => {
      e.preventDefault();
      const finish = () => { setCopiedKey(key); setTimeout(()=>setCopiedKey(null),1500); };
      if (navigator.clipboard) {
        navigator.clipboard.writeText(value.trim()).then(finish).catch(()=>{
          const el=document.createElement('textarea'); el.value=value.trim();
          document.body.appendChild(el); el.select(); document.execCommand('copy');
          document.body.removeChild(el); finish();
        });
      } else {
        const el=document.createElement('textarea'); el.value=value.trim();
        document.body.appendChild(el); el.select(); document.execCommand('copy');
        document.body.removeChild(el); finish();
      }
    };
    return (
      <button onClick={doCopy} title="Vágólapra másolás"
        style={{background:"none",border:"none",cursor:"pointer",padding:"2px 4px",color:copied?"#16a34a":C.textMuted,fontSize:"11px",lineHeight:1,marginLeft:"4px",opacity:copied?1:0.5,transition:"all 0.2s",verticalAlign:"middle"}}>
        {copied?"✓":"⎘"}
      </button>
    );
  };

  const hasActiveFilter = !!search.trim() || selUnit !== null;

  // ── Táblázat stílusok ────────────────────────────────────────────────────────
  const TH = { padding:"11px 14px",textAlign:"left",fontSize:"10.5px",fontWeight:"700",letterSpacing:"0.09em",textTransform:"uppercase",color:C.thText,backgroundColor:C.thBg,cursor:"pointer",userSelect:"none",whiteSpace:"nowrap",borderBottom:`1px solid ${C.thBorder}` };
  const TD = { padding:"11px 14px",fontSize:"13.5px",color:C.tdText,borderBottom:`1px solid ${C.tdBorder}`,verticalAlign:"top" };

  // ── Betöltési képernyő ───────────────────────────────────────────────────────
  if (loading) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",backgroundColor:dark?DARK.pageBg:LIGHT.pageBg,flexDirection:"column",gap:"16px"}}>
      <div style={{width:"40px",height:"40px",border:"3px solid #3b82f6",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:"#64748b",fontSize:"14px"}}>Adatok betöltése...</span>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'Outfit','Segoe UI',system-ui,sans-serif",minHeight:"100vh",backgroundColor:C.pageBg,display:"flex",flexDirection:"column",transition:"background-color 0.2s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; }
        .row-hover:hover td { background-color:${C.rowHover} !important; }
        .unit-tab:hover { background-color:${dark?"#162032":"#1e2f47"} !important; color:${dark?"#c0d4e8":"#e2e8f0"} !important; }
        .sth:hover { color:${dark?"#c0d4e8":"#c7dff7"} !important; }
        .ibtn:hover { filter:brightness(1.2); transform:scale(1.05); }
        input:focus,select:focus { border-color:#3b82f6 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.15) !important; outline:none; }
        ::-webkit-scrollbar{width:5px;height:5px;}
        ::-webkit-scrollbar-thumb{background:${dark?"#1e3347":"#cbd5e1"};border-radius:3px;}
        .export-dd button:hover{background-color:${dark?"#162540":"#eff6ff"} !important;}
        @keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}
        @media print{
          header,footer,.no-print,.unit-tab-bar{display:none!important;}
          body{background:white!important;}
          table{page-break-inside:auto;}
          tr{page-break-inside:avoid;}
          thead{display:table-header-group;}
          th{background-color:#1a1a2e!important;color:white!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
          td{color:#000!important;border-bottom:1px solid #ddd!important;}
          a{color:#000!important;text-decoration:none!important;}
          .print-header{display:block!important;margin-bottom:16px;}
        }
        .print-header{display:none;}
      `}</style>

      {/* ── NYOMTATÁS FEJLÉC (csak printnél látható) ── */}
      <div className="print-header" style={{padding:"12px 20px",borderBottom:"2px solid #0d1b2e",marginBottom:"12px"}}>
        <h1 style={{fontSize:"20px",fontWeight:"700",margin:0}}>{labels.title}</h1>
        <div style={{fontSize:"12px",color:"#475569",marginTop:"4px"}}>{new Date().toLocaleDateString("hu-HU")} – {filtered.length} munkatárs</div>
      </div>

      {/* ── FEJLÉC ── */}
      <header className="no-print" style={{backgroundColor:C.header,height:"58px",padding:"0 20px",display:"flex",alignItems:"center",gap:"14px",flexShrink:0,borderBottom:`1px solid ${C.headerBorder}`}}>
        <div style={{display:"flex",alignItems:"center",gap:"9px",flexShrink:0}}>
          <div style={{width:"30px",height:"30px",background:"linear-gradient(135deg,#3b82f6,#1d4ed8)",borderRadius:"8px",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",boxShadow:"0 2px 6px rgba(59,130,246,0.4)"}}>📋</div>
          <span style={{color:"#ffffff",fontWeight:"700",fontSize:"15px",letterSpacing:"-0.02em"}}>{labels.title}</span>
          {isAdmin && <span style={{backgroundColor:isSuperAdmin?C.amber:"#22c55e",color:"#0d1b2e",fontSize:"9.5px",fontWeight:"800",padding:"2px 8px",borderRadius:"20px",letterSpacing:"0.08em"}}>{isSuperAdmin?"FŐADMIN":"SZERKESZTŐ"}</span>}
        </div>

        <div style={{flex:1,maxWidth:"420px",position:"relative"}}>
          <svg style={{position:"absolute",left:"11px",top:"50%",transform:"translateY(-50%)",width:"14px",height:"14px",color:"#4a6380"}} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input type="text" placeholder="Keresés névben, telefonban, emailben..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:"100%",padding:"7px 32px 7px 34px",backgroundColor:C.inputHeaderBg,border:`1px solid ${C.inputHeaderBorder}`,borderRadius:"8px",color:C.inputHeaderText,fontSize:"13px"}}/>
          {search && <button onClick={()=>setSearch("")} style={{position:"absolute",right:"10px",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#4a6380",cursor:"pointer",fontSize:"17px",lineHeight:1,padding:"2px"}}>×</button>}
        </div>

        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"8px"}}>
          <button onClick={()=>setDark(d=>!d)} title={dark?"Világos mód":"Sötét mód"}
            style={{width:"34px",height:"34px",backgroundColor:dark?"#1e3347":"#162032",border:`1px solid ${C.inputHeaderBorder}`,borderRadius:"8px",cursor:"pointer",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            {dark?"☀️":"🌙"}
          </button>

          <div style={{position:"relative"}}>
            <button onClick={()=>setExportOpen(o=>!o)}
              style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 13px",backgroundColor:dark?"#1e3347":"#162032",border:`1px solid ${C.inputHeaderBorder}`,borderRadius:"7px",color:"#7aa3cc",fontSize:"12.5px",cursor:"pointer",whiteSpace:"nowrap"}}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
              Letöltés
              <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7"/></svg>
            </button>
            {exportOpen && (
              <>
                <div onClick={()=>setExportOpen(false)} style={{position:"fixed",inset:0,zIndex:90}}/>
                <div className="export-dd" style={{position:"absolute",right:0,top:"calc(100% + 6px)",backgroundColor:dark?"#111d2e":"#ffffff",border:`1px solid ${C.cardBorder}`,borderRadius:"10px",boxShadow:"0 8px 24px rgba(0,0,0,0.15)",padding:"6px",zIndex:100,minWidth:"220px"}}>
                  {[{type:"xlsx",icon:"📊",label:"Excel (.xlsx)",sub:"Táblázat, szerkeszthető"},{type:"google",icon:"📇",label:"Google Névjegyek (.csv)",sub:"Importálható névjegy formátum"}].map(({type,icon,label,sub})=>(
                    <button key={type} onClick={()=>openExportModal(type)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:"10px",padding:"9px 12px",backgroundColor:"transparent",border:"none",borderRadius:"7px",cursor:"pointer",textAlign:"left",color:C.text,fontSize:"13px"}}>
                      <span style={{fontSize:"18px"}}>{icon}</span>
                      <div><div style={{fontWeight:"600"}}>{label}</div><div style={{fontSize:"11px",color:C.textMuted,marginTop:"1px"}}>{sub}</div></div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {isAdmin ? (
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
              <span style={{fontSize:"12px",color:"#5a7fa0",maxWidth:"120px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser.displayName}</span>
              <button onClick={logout} style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 13px",backgroundColor:"transparent",border:`1px solid #2a3f58`,borderRadius:"7px",color:"#7aa3cc",fontSize:"12.5px",cursor:"pointer"}}>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                Kilépés
              </button>
            </div>
          ) : (
            <button onClick={()=>setLoginOpen(true)} style={{display:"flex",alignItems:"center",gap:"6px",padding:"6px 13px",backgroundColor:dark?"#1e3347":"#162032",border:`1px solid ${C.inputHeaderBorder}`,borderRadius:"7px",color:"#7aa3cc",fontSize:"12.5px",cursor:"pointer"}}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              Belépés
            </button>
          )}
        </div>
      </header>

      {/* ── EGYSÉG SZŰRŐ SÁV ── */}
      <div className="no-print unit-tab-bar" style={{backgroundColor:C.tabBar,borderBottom:`1px solid ${C.tabBorder}`,display:"flex",alignItems:"stretch",overflowX:"auto",flexShrink:0,padding:"0 16px"}}>
        {[{id:null,name:`Összes ${labels.units}`},...units].map(u=>{
          const active=selUnit===u.id;
          return (
            <button key={u.id??"all"} className="unit-tab" onClick={()=>setSelUnit(u.id)}
              style={{padding:"0 16px",height:"42px",backgroundColor:"transparent",border:"none",borderBottom:active?`2px solid ${C.blue}`:"2px solid transparent",color:active?C.tabActive:C.tabText,fontSize:"13px",fontWeight:active?"600":"400",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"7px",transition:"all 0.12s"}}>
              {u.name}
              {u.id!==null && <span style={{fontSize:"11px",backgroundColor:active?C.countBadgeBg:C.countBadgeInactiveBg,color:active?C.countBadgeText:C.countBadgeInactiveText,padding:"1px 7px",borderRadius:"10px",fontWeight:"600"}}>{empCount(u.id)}</span>}
            </button>
          );
        })}
        {employees.filter(e=>e.unit_id==null&&(isAdmin||e.active)).length>0 && (
          <button className="unit-tab" onClick={()=>setSelUnit("unassigned")}
            style={{padding:"0 16px",height:"42px",backgroundColor:"transparent",border:"none",borderBottom:selUnit==="unassigned"?`2px solid #f59e0b`:"2px solid transparent",color:selUnit==="unassigned"?"#f59e0b":C.tabText,fontSize:"13px",fontWeight:selUnit==="unassigned"?"600":"400",cursor:"pointer",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"7px"}}>
            ⚠ {labels.units} nélkül
            <span style={{fontSize:"11px",backgroundColor:selUnit==="unassigned"?"rgba(245,158,11,0.2)":C.countBadgeInactiveBg,color:selUnit==="unassigned"?"#f59e0b":C.countBadgeInactiveText,padding:"1px 7px",borderRadius:"10px",fontWeight:"600"}}>{empCount("unassigned")}</span>
          </button>
        )}
      </div>

      {/* ── FŐ TARTALOM ── */}
      <main style={{flex:1,padding:"20px",overflow:"auto"}}>

        {isAdmin && (
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"16px",flexWrap:"wrap"}}>
            <div style={{display:"flex",backgroundColor:C.segmentBg,borderRadius:"8px",padding:"3px",gap:"3px"}}>
              {[{v:"employees",l:labels.employees},{v:"units",l:labels.units},{v:"users",l:"👥 Felhasználók"},{v:"settings",l:"⚙️ Beállítások"},...(isSuperAdmin?[{v:"log",l:"📋 Log"}]:[])].map(t=>(
                <button key={t.v} onClick={()=>setAdminTab(t.v)}
                  style={{padding:"5px 14px",backgroundColor:adminTab===t.v?C.segmentActive:"transparent",color:adminTab===t.v?C.text:C.textLight,border:"none",borderRadius:"6px",fontSize:"12.5px",fontWeight:adminTab===t.v?"600":"400",cursor:"pointer",boxShadow:adminTab===t.v?"0 1px 3px rgba(0,0,0,0.15)":"none",transition:"all 0.15s"}}>
                  {t.l}
                </button>
              ))}
            </div>
            {adminTab==="employees" && (
              <div style={{marginLeft:"auto",display:"flex",gap:"8px",alignItems:"center"}}>
                <input ref={importInputRef} type="file" accept=".csv" onChange={handleImportFile} style={{display:"none"}}/>
                <button onClick={()=>importInputRef.current?.click()} style={{display:"flex",alignItems:"center",gap:"6px",padding:"7px 14px",backgroundColor:dark?"#1e3347":"#f0fdf4",color:dark?"#4ade80":"#16a34a",border:`1px solid ${dark?"#166534":"#86efac"}`,borderRadius:"7px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}}>↑ Importálás</button>
                <button onClick={()=>setEmpModal({...EMPTY_EMP})} style={{display:"flex",alignItems:"center",gap:"6px",padding:"7px 16px",backgroundColor:C.blue,color:"#fff",border:"none",borderRadius:"7px",fontSize:"13px",fontWeight:"600",cursor:"pointer",boxShadow:"0 2px 6px rgba(59,130,246,0.3)"}}>+ Új munkatárs</button>
              </div>
            )}
            {adminTab==="units"     && <button onClick={()=>setUnitModal({name:""})} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"6px",padding:"7px 16px",backgroundColor:C.blue,color:"#fff",border:"none",borderRadius:"7px",fontSize:"13px",fontWeight:"600",cursor:"pointer",boxShadow:"0 2px 6px rgba(59,130,246,0.3)"}}>+ Új {labels.units.toLowerCase().replace(/[aáeéiíoóöőuúüű]k$/i,"")}</button>}
            {adminTab==="users" && isSuperAdmin && <button onClick={()=>setUserModal({username:"",password:"",displayName:"",role:"editor"})} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"6px",padding:"7px 16px",backgroundColor:C.blue,color:"#fff",border:"none",borderRadius:"7px",fontSize:"13px",fontWeight:"600",cursor:"pointer",boxShadow:"0 2px 6px rgba(59,130,246,0.3)"}}>+ Új felhasználó</button>}
          </div>
        )}

        {/* Tömeges műveletek sáv */}
        {isAdmin && adminTab==="employees" && selectedIds.size>0 && (() => {
          const selectedEmps = [...selectedIds].map(id=>employees.find(e=>e.id===id)).filter(Boolean);
          const hasActive    = selectedEmps.some(e=>e.active);
          const hasArchived  = selectedEmps.some(e=>!e.active);
          return (
            <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap",padding:"10px 14px",marginBottom:"10px",backgroundColor:dark?"#0f1a28":"#eff6ff",border:`1px solid ${C.blue}`,borderRadius:"9px",fontSize:"13px"}}>
              <span style={{color:C.blue,fontWeight:"600"}}>{selectedIds.size} munkatárs kijelölve</span>
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginLeft:"auto"}}>
                <select value={bulkUnit} onChange={e=>setBulkUnit(e.target.value)} style={{...inp(C),width:"auto",padding:"5px 10px",fontSize:"12.5px"}}>
                  <option value="">— Egység módosítása —</option>
                  {units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                  <option value="null">Nincs egység</option>
                </select>
                <button disabled={!bulkUnit} onClick={async()=>{
                  const uid=bulkUnit==="null"?null:parseInt(bulkUnit);
                  const count=selectedIds.size;
                  for(const id of selectedIds){
                    const emp=employees.find(e=>e.id===id);
                    if(!emp) continue;
                    try{const u=await call(`/api/employees/${id}`,"PUT",{...emp,unit_id:uid},token);setEmployees(p=>p.map(e=>e.id===id?u:e));}catch{}
                  }
                  setSelectedIds(new Set());setBulkUnit("");
                  showToast(`${count} munkatárs egysége módosítva`);
                }} style={{padding:"5px 12px",backgroundColor:C.blue,color:"#fff",border:"none",borderRadius:"6px",fontSize:"12.5px",fontWeight:"600",cursor:bulkUnit?"pointer":"default",opacity:bulkUnit?1:0.5}}>Alkalmaz</button>
              </div>
              {hasActive && (
                <button onClick={async()=>{
                  const count=selectedIds.size;
                  for(const id of selectedIds){
                    const emp=employees.find(e=>e.id===id);
                    if(!emp||!emp.active) continue;
                    try{const u=await call(`/api/employees/${id}`,"PUT",{...emp,active:false},token);setEmployees(p=>p.map(e=>e.id===id?u:e));}catch{}
                  }
                  setSelectedIds(new Set());
                  showToast(`${count} munkatárs archiválva`);
                }} style={{padding:"5px 12px",backgroundColor:dark?"#2a1e00":"#fef3c7",color:"#d97706",border:"none",borderRadius:"6px",fontSize:"12.5px",cursor:"pointer"}}>📁 Archiválás</button>
              )}
              {hasArchived && (
                <button onClick={async()=>{
                  const count=selectedIds.size;
                  for(const id of selectedIds){
                    const emp=employees.find(e=>e.id===id);
                    if(!emp||emp.active) continue;
                    try{const u=await call(`/api/employees/${id}`,"PUT",{...emp,active:true},token);setEmployees(p=>p.map(e=>e.id===id?u:e));}catch{}
                  }
                  setSelectedIds(new Set());
                  showToast(`${count} munkatárs visszaállítva`);
                }} style={{padding:"5px 12px",backgroundColor:dark?"#0a2010":"#dcfce7",color:"#16a34a",border:"none",borderRadius:"6px",fontSize:"12.5px",cursor:"pointer"}}>♻️ Visszaállítás</button>
              )}
              <button onClick={()=>setBulkDeleteConfirm(true)} style={{padding:"5px 12px",backgroundColor:dark?"#3d1515":"#fee2e2",color:"#dc2626",border:"none",borderRadius:"6px",fontSize:"12.5px",cursor:"pointer"}}>🗑️ Törlés</button>
              <button onClick={()=>setSelectedIds(new Set())} style={{padding:"5px 12px",backgroundColor:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:"6px",color:C.textLight,fontSize:"12.5px",cursor:"pointer"}}>Kijelölés törlése</button>
            </div>
          );
        })()}

        {/* Infó sáv */}
        {(!isAdmin||adminTab==="employees") && (
          <div style={{marginBottom:"10px",fontSize:"12.5px",color:C.textMuted,display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
            <span>{filtered.length} munkatárs</span>
            {selUnit && typeof selUnit==="number" && <><span>·</span><span style={{color:C.textLight}}>{uName(selUnit)}</span></>}
            {selUnit==="unassigned" && <><span>·</span><span style={{color:"#d97706"}}>{labels.units} nélkül</span></>}
            {search && <><span>·</span><span>keresés: <b style={{color:C.textLight}}>{search}</b></span></>}
            {isAdmin && employees.filter(e=>!e.active).length>0 && <span style={{marginLeft:"auto",color:C.amber,fontSize:"11.5px"}}>⚠ {employees.filter(e=>!e.active).length} archivált munkatárs is látható</span>}
            {!isAdmin && <button className="no-print" onClick={()=>window.print()} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"5px",padding:"5px 12px",backgroundColor:dark?"#1e3347":"#f1f5f9",border:`1px solid ${C.cardBorder}`,borderRadius:"7px",color:C.textMid,fontSize:"12px",cursor:"pointer"}}>🖨 Nyomtatás</button>}
          </div>
        )}

        {/* ── MUNKATÁRS TÁBLÁZAT ── */}
        {(!isAdmin||adminTab==="employees") && (
          <>
          <div className="print-header">
            <h1 style={{fontSize:"18px",fontWeight:"700",margin:"0 0 4px 0"}}>{labels.title}</h1>
            <p style={{fontSize:"12px",color:"#666",margin:0}}>
              Nyomtatva: {new Date().toLocaleDateString("hu-HU")}
              {" – "}{filtered.length} munkatárs
              {selUnit&&typeof selUnit==="number"?` · ${uName(selUnit)}`:""}
              {selUnit==="unassigned"?` · ${labels.units} nélkül`:""}
              {search.trim()?` · keresés: "${search.trim()}"` : ""}
            </p>
          </div>
          <div style={{backgroundColor:C.cardBg,borderRadius:"12px",overflow:"hidden",boxShadow:dark?"0 2px 12px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.07)",border:`1px solid ${C.cardBorder}`}}>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    {isAdmin && (
                      <th style={{...TH,width:"36px",cursor:"default"}}>
                        <input type="checkbox"
                          checked={selectedIds.size>0 && filtered.every(e=>selectedIds.has(e.id))}
                          onChange={e=>setSelectedIds(e.target.checked ? new Set(filtered.map(e=>e.id)) : new Set())}
                          style={{cursor:"pointer"}}/>
                      </th>
                    )}
                    {[{key:"name",label:"Név"},{key:"position",label:"Beosztás"},{key:"phone",label:"Telefonszám"},{key:"email_1",label:"Email cím(ek)"},{key:"unit",label:labels.units}].map(col=>(
                      <th key={col.key} className="sth" style={TH} onClick={()=>handleSort(col.key)}>
                        <span style={{display:"flex",alignItems:"center",gap:"5px"}}>{col.label} {sortIcon(col.key)}</span>
                      </th>
                    ))}
                    {isAdmin && <th style={{...TH,width:"100px",cursor:"default"}}>Műveletek</th>}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length===0 ? (
                    <tr><td colSpan={isAdmin?7:5} style={{padding:"48px 20px",textAlign:"center",color:C.textMuted,fontSize:"14px"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>🔍</div>Nincs találat</td></tr>
                  ) : filtered.map((emp,idx)=>(
                    <tr key={emp.id} className="row-hover" style={{backgroundColor:!emp.active?C.rowArchived:idx%2===0?C.cardBg:C.cardBg2}}>
                      {isAdmin && (
                        <td style={{...TD,width:"36px"}}>
                          <input type="checkbox" checked={selectedIds.has(emp.id)}
                            onChange={e=>setSelectedIds(prev=>{const n=new Set(prev);e.target.checked?n.add(emp.id):n.delete(emp.id);return n;})}
                            style={{cursor:"pointer"}}/>
                        </td>
                      )}
                      <td style={{...TD,fontWeight:"600",color:C.text}}>
                        <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                          <div style={{width:"28px",height:"28px",borderRadius:"50%",backgroundColor:C.blueSoft,color:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:"700",flexShrink:0}}>
                            {emp.name.split(" ").slice(0,2).map(n=>n[0]).join("")}
                          </div>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                              <span>{emp.name}</span>
                              <button onClick={()=>downloadVCard(emp)} title="vCard letöltése" style={{background:"none",border:"none",cursor:"pointer",padding:"1px 3px",fontSize:"12px",lineHeight:1,color:C.textMuted,opacity:0.6,transition:"opacity 0.15s"}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.6"}>📇</button>
                            </div>
                            {!emp.active && <span style={{fontSize:"10px",backgroundColor:dark?"#2a1e00":"#fef3c7",color:"#d97706",padding:"1px 6px",borderRadius:"8px",fontWeight:"700"}}>ARCHIVÁLT</span>}
                          </div>
                        </div>
                      </td>
                      <td style={{...TD,color:C.tdTextLight,fontSize:"13px"}}>{emp.position}</td>
                      <td style={TD}>
                        {fmtPhone(emp.phone) ? (
                          <div>
                            <a href={`tel:${fmtPhone(emp.phone)}`} style={{fontFamily:"'JetBrains Mono','Courier New',monospace",fontSize:"12.5px",color:C.tdTextMid,textDecoration:"none"}} onMouseEnter={e=>e.target.style.textDecoration="underline"} onMouseLeave={e=>e.target.style.textDecoration="none"}>{fmtPhone(emp.phone)}</a>
                            {copyBtn(fmtPhone(emp.phone), `${emp.id}_p1`)}
                          </div>
                        ) : <span style={{color:C.textMuted}}>—</span>}
                        {fmtPhone(emp.phone_2) && (
                          <div style={{marginTop:"3px"}}>
                            <a href={`tel:${fmtPhone(emp.phone_2)}`} style={{fontFamily:"'JetBrains Mono','Courier New',monospace",fontSize:"11.5px",color:C.textMuted,textDecoration:"none"}} onMouseEnter={e=>e.target.style.textDecoration="underline"} onMouseLeave={e=>e.target.style.textDecoration="none"}>{fmtPhone(emp.phone_2)}</a>
                            {copyBtn(fmtPhone(emp.phone_2), `${emp.id}_p2`)}
                          </div>
                        )}
                      </td>
                      <td style={TD}>
                        {[emp.email_1,emp.email_2,emp.email_3].filter(Boolean).map((em,i)=>(
                          <div key={i} style={{marginBottom:i<2?"2px":0}}>
                            <a href={`mailto:${em}`} style={{color:C.blue,textDecoration:"none",fontSize:"13px"}} onMouseEnter={e=>e.target.style.textDecoration="underline"} onMouseLeave={e=>e.target.style.textDecoration="none"}>{em}</a>
                            {copyBtn(em, `${emp.id}_e${i}`)}
                          </div>
                        ))}
                      </td>
                      <td style={TD}>
                        <span style={{display:"inline-block",padding:"3px 10px",backgroundColor:emp.unit_id==null?(dark?"#2a1e00":"#fef3c7"):C.blueSoft,color:emp.unit_id==null?"#d97706":C.blueText,borderRadius:"20px",fontSize:"12px",fontWeight:"500"}}>
                          {uName(emp.unit_id)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td style={{...TD,whiteSpace:"nowrap"}}>
                          <button className="ibtn" onClick={()=>setEmpModal({...emp})} title="Szerkesztés" style={{width:"28px",height:"28px",backgroundColor:dark?"#1a3560":"#dbeafe",color:dark?"#60a5fa":"#2563eb",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"13px",marginRight:"5px",transition:"all 0.1s"}}>✏️</button>
                          <button className="ibtn" onClick={()=>toggleActive(emp.id)} title={emp.active?"Archiválás":"Visszaállítás"} style={{width:"28px",height:"28px",backgroundColor:emp.active?(dark?"#2a1e00":"#fef3c7"):(dark?"#0a2010":"#dcfce7"),color:emp.active?"#d97706":"#16a34a",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"13px",marginRight:"5px",transition:"all 0.1s"}}>{emp.active?"📁":"♻️"}</button>
                          <button className="ibtn" onClick={()=>setDeleteConfirm(emp)} title="Törlés" style={{width:"28px",height:"28px",backgroundColor:dark?"#3d1515":"#fee2e2",color:"#dc2626",border:"none",borderRadius:"6px",cursor:"pointer",fontSize:"13px",transition:"all 0.1s"}}>🗑️</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{padding:"10px 16px",borderTop:`1px solid ${C.cardFoot}`,backgroundColor:C.cardFoot,display:"flex",justifyContent:"space-between"}}>
              <span style={{fontSize:"12px",color:C.footText}}>Összesen: {filtered.length} / {isAdmin?employees.length:employees.filter(e=>e.active).length} munkatárs</span>
              <span style={{fontSize:"11px",color:C.footText}}>Kattintson az oszlop fejlécére a rendezéshez</span>
            </div>
          </div>
          </>
        )}

        {/* ── EGYSÉGEK TÁBLÁZAT ── */}
        {isAdmin && adminTab==="units" && (
          <div style={{backgroundColor:C.cardBg,borderRadius:"12px",overflow:"hidden",boxShadow:dark?"0 2px 12px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.07)",border:`1px solid ${C.cardBorder}`}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{[`${labels.units} neve`,"Aktív munkatársak","Archivált","Műveletek"].map(l=>(<th key={l} style={{...TH,cursor:"default"}}>{l}</th>))}</tr></thead>
              <tbody>
                {units.map((unit,idx)=>{
                  const actC=employees.filter(e=>e.unit_id===unit.id&&e.active).length;
                  const archC=employees.filter(e=>e.unit_id===unit.id&&!e.active).length;
                  return (
                    <tr key={unit.id} className="row-hover" style={{backgroundColor:idx%2===0?C.cardBg:C.cardBg2}}>
                      <td style={{...TD,fontWeight:"600",fontSize:"14px",color:C.text}}><div style={{display:"flex",alignItems:"center",gap:"8px"}}><div style={{width:"8px",height:"8px",borderRadius:"50%",backgroundColor:C.blue}}/>{unit.name}</div></td>
                      <td style={TD}>{actC} fő</td>
                      <td style={TD}>{archC>0?<span style={{color:"#d97706"}}>{archC} fő</span>:<span style={{color:C.textMuted}}>–</span>}</td>
                      <td style={{...TD,whiteSpace:"nowrap"}}>
                        <button onClick={()=>moveUnit(unit.id,"up")} disabled={idx===0} title="Fel" style={{padding:"4px 8px",backgroundColor:dark?"#162032":"#f1f5f9",color:idx===0?C.textMuted:C.textMid,border:`1px solid ${C.cardBorder}`,borderRadius:"5px",fontSize:"12px",cursor:idx===0?"default":"pointer",marginRight:"4px",opacity:idx===0?0.4:1}}>▲</button>
                        <button onClick={()=>moveUnit(unit.id,"down")} disabled={idx===units.length-1} title="Le" style={{padding:"4px 8px",backgroundColor:dark?"#162032":"#f1f5f9",color:idx===units.length-1?C.textMuted:C.textMid,border:`1px solid ${C.cardBorder}`,borderRadius:"5px",fontSize:"12px",cursor:idx===units.length-1?"default":"pointer",marginRight:"6px",opacity:idx===units.length-1?0.4:1}}>▼</button>
                        <button onClick={()=>setUnitModal({...unit})} style={{padding:"5px 12px",backgroundColor:dark?"#1a3560":"#dbeafe",color:dark?"#60a5fa":"#2563eb",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer",marginRight:"6px"}}>Átnevezés</button>
                        <button onClick={()=>setDeleteUnitConfirm(unit)} style={{padding:"5px 12px",backgroundColor:dark?"#3d1515":"#fee2e2",color:"#dc2626",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer"}}>🗑️ Törlés</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── FELHASZNÁLÓK TÁBLÁZAT ── */}
        {isAdmin && adminTab==="users" && (
          <div style={{backgroundColor:C.cardBg,borderRadius:"12px",overflow:"hidden",boxShadow:dark?"0 2px 12px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.07)",border:`1px solid ${C.cardBorder}`}}>
            <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.cardBorder}`}}>
              <span style={{fontSize:"13px",color:C.textLight}}>A <b style={{color:C.text}}>Főadmin</b> mindent lát és szerkeszthet, a <b style={{color:C.text}}>Szerkesztő</b> csak a munkatársakat és egységeket kezelheti.</span>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>{["Megjelenített név","Felhasználónév","Szerepkör","Műveletek"].map(l=>(<th key={l} style={{...TH,cursor:"default"}}>{l}</th>))}</tr></thead>
              <tbody>
                {users.map((u,idx)=>(
                  <tr key={u.id} className="row-hover" style={{backgroundColor:idx%2===0?C.cardBg:C.cardBg2}}>
                    <td style={{...TD,fontWeight:"600",color:C.text}}>
                      <div style={{display:"flex",alignItems:"center",gap:"9px"}}>
                        <div style={{width:"30px",height:"30px",borderRadius:"50%",backgroundColor:u.role==="superadmin"?"#fef3c7":C.blueSoft,color:u.role==="superadmin"?"#d97706":C.blueText,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"700",flexShrink:0}}>{u.displayName.charAt(0)}</div>
                        <div><div>{u.displayName}</div>{u.id===currentUser?.id&&<span style={{fontSize:"10px",color:C.blue,fontWeight:"600"}}>← te vagy</span>}</div>
                      </div>
                    </td>
                    <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",fontSize:"12.5px"}}>{u.username}</td>
                    <td style={TD}><span style={{display:"inline-block",padding:"3px 10px",borderRadius:"20px",fontSize:"11.5px",fontWeight:"700",backgroundColor:u.role==="superadmin"?"#fef3c7":C.blueSoft,color:u.role==="superadmin"?"#92400e":C.blueText}}>{u.role==="superadmin"?"Főadmin":"Szerkesztő"}</span></td>
                    <td style={{...TD,whiteSpace:"nowrap"}}>
                      {isSuperAdmin ? (
                        <>
                          <button onClick={()=>setUserModal({...u,password:""})} style={{padding:"5px 10px",backgroundColor:dark?"#1a3560":"#dbeafe",color:dark?"#60a5fa":"#2563eb",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer",marginRight:"6px"}}>✏️ Szerkesztés</button>
                          {u.id!==currentUser?.id && <button onClick={()=>deleteUser(u.id)} style={{padding:"5px 10px",backgroundColor:dark?"#3d1515":"#fee2e2",color:"#dc2626",border:"none",borderRadius:"6px",fontSize:"12px",cursor:"pointer"}}>🗑️ Törlés</button>}
                        </>
                      ) : <span style={{fontSize:"12px",color:C.textMuted}}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── BEÁLLÍTÁSOK ── */}
        {isAdmin && adminTab==="settings" && (
          <div style={{maxWidth:"520px"}}>
            <div style={{backgroundColor:C.cardBg,borderRadius:"12px",border:`1px solid ${C.cardBorder}`,overflow:"hidden",boxShadow:dark?"0 2px 12px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.07)"}}>
              <div style={{padding:"16px 20px",borderBottom:`1px solid ${C.cardBorder}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div><h3 style={{fontSize:"14px",fontWeight:"700",color:C.text,margin:0}}>Feliratok testreszabása</h3><p style={{fontSize:"12px",color:C.textMuted,marginTop:"4px"}}>Mentés után lépnek érvénybe a változtatások.</p></div>
                {JSON.stringify(labelDraft)!==JSON.stringify(labels) && <span style={{fontSize:"11px",backgroundColor:dark?"#2a1e00":"#fef3c7",color:"#d97706",padding:"3px 10px",borderRadius:"20px",fontWeight:"700"}}>● Nem mentett</span>}
              </div>
              <div style={{padding:"20px",display:"flex",flexDirection:"column",gap:"16px"}}>
                {[{key:"title",label:"TELEFONKÖNYV NEVE",sub:"(fejléc, Excel fájl)",icon:"📋",ph:"pl. Cégnév Telefonkönyv"},{key:"employees",label:"MUNKATÁRSAK FÜLET FELIRATA",sub:"",icon:"👤",ph:"pl. Dolgozók, Kollégák..."},{key:"units",label:"EGYSÉGEK FÜLET FELIRATA",sub:`(„Összes ${labelDraft.units}" szűrő is frissül)`,icon:"🏢",ph:"pl. Osztályok, Részlegek..."}].map(({key,label,sub,icon,ph})=>(
                  <div key={key}>
                    <label style={lbl(C)}>{label} {sub&&<span style={{fontSize:"10px",fontWeight:"400",color:C.textMuted}}>{sub}</span>}</label>
                    <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                      <input type="text" value={labelDraft[key]} onChange={e=>setLabelDraft(l=>({...l,[key]:e.target.value}))} placeholder={ph} style={inp(C)}/>
                      <div style={{fontSize:"20px",flexShrink:0}}>{icon}</div>
                    </div>
                  </div>
                ))}
                <div style={{height:"1px",backgroundColor:C.cardBorder}}/>
                <div style={{display:"flex",gap:"8px",justifyContent:"space-between",alignItems:"center"}}>
                  <button onClick={()=>{const d={title:"Telefonkönyv",employees:"Munkatársak",units:"Egységek"};setLabelDraft(d);setLabels(d);call("/api/settings","PUT",d,token).catch(console.error);}} style={{padding:"7px 14px",backgroundColor:"transparent",border:`1px solid ${C.cardBorder}`,borderRadius:"7px",color:C.textLight,fontSize:"12.5px",cursor:"pointer"}}>↺ Visszaállítás</button>
                  <button onClick={saveLabels} disabled={JSON.stringify(labelDraft)===JSON.stringify(labels)} style={{padding:"9px 24px",backgroundColor:JSON.stringify(labelDraft)!==JSON.stringify(labels)?C.blue:"#94a3b8",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:JSON.stringify(labelDraft)!==JSON.stringify(labels)?"pointer":"not-allowed",transition:"all 0.2s"}}>Mentés</button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ── AUDIT LOG ── */}
        {isAdmin && adminTab==="log" && isSuperAdmin && (
          <div style={{backgroundColor:C.cardBg,borderRadius:"12px",overflow:"hidden",boxShadow:dark?"0 2px 12px rgba(0,0,0,0.4)":"0 1px 3px rgba(0,0,0,0.07)",border:`1px solid ${C.cardBorder}`}}>
            <div style={{padding:"12px 18px",borderBottom:`1px solid ${C.cardBorder}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:"13px",fontWeight:"600",color:C.text}}>Utolsó 200 esemény</span>
              <button onClick={()=>call("/api/audit","GET",null,token).then(setAuditLog).catch(console.error)} style={{padding:"5px 12px",backgroundColor:dark?"#1e3347":"#f1f5f9",border:`1px solid ${C.cardBorder}`,borderRadius:"6px",color:C.textMid,fontSize:"12px",cursor:"pointer"}}>↻ Frissítés</button>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    {["Időpont","Felhasználó","Művelet","Entitás","ID","Részlet"].map(l=>(
                      <th key={l} style={{...TH,cursor:"default"}}>{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditLog.length===0 ? (
                    <tr><td colSpan={6} style={{padding:"40px 20px",textAlign:"center",color:C.textMuted}}>Nincs naplóbejegyzés</td></tr>
                  ) : auditLog.map((row,idx)=>{
                    const actionColors = {CREATE:"#16a34a",UPDATE:"#2563eb",DELETE:"#dc2626",LOGIN:"#7c3aed",LOGOUT:"#475569",REORDER:"#d97706"};
                    return (
                      <tr key={row.id} className="row-hover" style={{backgroundColor:idx%2===0?C.cardBg:C.cardBg2}}>
                        <td style={{...TD,fontFamily:"'JetBrains Mono',monospace",fontSize:"11.5px",whiteSpace:"nowrap"}}>{row.ts.replace("T"," ").slice(0,19)}</td>
                        <td style={{...TD,fontSize:"13px"}}>{row.username||"—"}</td>
                        <td style={TD}><span style={{display:"inline-block",padding:"2px 9px",borderRadius:"20px",fontSize:"11px",fontWeight:"700",backgroundColor:(actionColors[row.action]||C.blue)+"22",color:actionColors[row.action]||C.blue}}>{row.action}</span></td>
                        <td style={{...TD,fontSize:"12.5px"}}>{row.entity}</td>
                        <td style={{...TD,fontSize:"12.5px",color:C.textMuted}}>{row.entity_id||"—"}</td>
                        <td style={{...TD,fontSize:"12.5px",color:C.textLight,maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.detail||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── LÁBLÉC ── */}
      <footer style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:`1px solid ${C.cardBorder}`,flexShrink:0}}>
        <span style={{fontSize:"11px",color:C.textMuted,fontFamily:"'JetBrains Mono',monospace",letterSpacing:"0.04em"}}>V0.01</span>
        <span style={{fontSize:"11px",color:dark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)",letterSpacing:"0.06em",userSelect:"none"}}>by Dark</span>
      </footer>

      {/* ── EXPORT MODAL ── */}
      {exportModal && (
        <Overlay onClose={()=>setExportModal(null)} C={C}>
          <div style={{marginBottom:"18px"}}>
            <p style={{fontSize:"12px",color:C.textMuted,marginBottom:"3px",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:"600"}}>Exportálás</p>
            <h2 style={{fontSize:"17px",fontWeight:"700",color:C.text}}>{exportModal==="xlsx"?"📊 Excel (.xlsx)":"📇 Google Névjegyek (.csv)"}</h2>
            <p style={{fontSize:"13px",color:C.textLight,marginTop:"6px"}}>Válaszd ki, milyen adatokat exportáljon:</p>
          </div>
          {hasActiveFilter && (
            <button onClick={()=>handleExport(exportModal,"filtered",null)}
              style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",backgroundColor:dark?"#0f2040":C.blueSoft,border:`1.5px solid ${C.blue}`,borderRadius:"10px",cursor:"pointer",marginBottom:"10px",textAlign:"left"}}
              onMouseEnter={e=>e.currentTarget.style.opacity="0.85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"9px",backgroundColor:C.blue,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px",flexShrink:0}}>🔍</div>
                <div>
                  <div style={{fontWeight:"700",fontSize:"13.5px",color:C.blue}}>Jelenlegi szűrés</div>
                  <div style={{fontSize:"12px",color:C.blueText,marginTop:"2px"}}>
                    {search.trim()?`Keresés: "${search.trim()}" · `:""}
                    {selUnit&&typeof selUnit==="number"?uName(selUnit):""}
                    {selUnit==="unassigned"?`${labels.units} nélkül`:""}
                  </div>
                </div>
              </div>
              <span style={{backgroundColor:C.blue,color:"#fff",padding:"3px 12px",borderRadius:"20px",fontSize:"12px",fontWeight:"700",whiteSpace:"nowrap",marginLeft:"12px"}}>{filtered.filter(e=>e.active).length} fő</span>
            </button>
          )}
          <button onClick={()=>handleExport(exportModal,"all",null)}
            style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",backgroundColor:C.cardBg,border:`1.5px solid ${C.cardBorder}`,borderRadius:"10px",cursor:"pointer",marginBottom:"10px",textAlign:"left"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.blue;e.currentTarget.style.backgroundColor=C.rowHover;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.backgroundColor=C.cardBg;}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{width:"38px",height:"38px",borderRadius:"9px",backgroundColor:C.blueSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px",flexShrink:0}}>🏢</div>
              <div><div style={{fontWeight:"600",fontSize:"13.5px",color:C.text}}>Összes munkatárs</div><div style={{fontSize:"12px",color:C.textMuted,marginTop:"2px"}}>Minden aktív munkatárs exportálása</div></div>
            </div>
            <span style={{backgroundColor:C.blueSoft,color:C.blueText,padding:"3px 12px",borderRadius:"20px",fontSize:"12px",fontWeight:"700",whiteSpace:"nowrap",marginLeft:"12px"}}>{employees.filter(e=>e.active).length} fő</span>
          </button>
          <div style={{padding:"14px 16px",backgroundColor:C.cardBg,border:`1.5px solid ${C.cardBorder}`,borderRadius:"10px",marginBottom:"20px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"12px"}}>
              <div style={{width:"38px",height:"38px",borderRadius:"9px",backgroundColor:C.blueSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"19px",flexShrink:0}}>📂</div>
              <div><div style={{fontWeight:"600",fontSize:"13.5px",color:C.text}}>Csak egy {labels.units.toLowerCase().replace(/[aáeéiíoóöőuúüű]k$/i,"")}</div><div style={{fontSize:"12px",color:C.textMuted,marginTop:"2px"}}>Válaszd ki a {labels.units.toLowerCase().replace(/[aáeéiíoóöőuúüű]k$/i,"")}-t az alábbi listából</div></div>
            </div>
            <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
              <select value={exportUnitId||""} onChange={e=>setExportUnitId(parseInt(e.target.value))} style={{flex:1,...inp(C),padding:"8px 12px",fontSize:"13px"}}>
                {units.map(u=>(<option key={u.id} value={u.id}>{u.name}  –  {employees.filter(e=>e.active&&e.unit_id===u.id).length} fő</option>))}
              </select>
              <button onClick={()=>handleExport(exportModal,"unit",exportUnitId)} style={{padding:"8px 16px",backgroundColor:C.blue,color:"#fff",border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>Exportálás</button>
            </div>
          </div>
          <div style={{display:"flex",justifyContent:"flex-end"}}><button onClick={()=>setExportModal(null)} style={cancelBtn(C)}>Mégse</button></div>
        </Overlay>
      )}

      {/* ── BEJELENTKEZÉS MODAL ── */}
      {loginOpen && (
        <Overlay onClose={()=>{setLoginOpen(false);setLoginUser("");setLoginPw("");setLoginErr("");}} C={C}>
          <div style={{textAlign:"center",marginBottom:"22px"}}>
            <div style={{width:"48px",height:"48px",background:"linear-gradient(135deg,#1e3a5f,#0d1b2e)",borderRadius:"12px",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"22px",marginBottom:"12px"}}>🔐</div>
            <h2 style={{fontSize:"18px",fontWeight:"700",color:C.text}}>Admin belépés</h2>
          </div>
          <label style={lbl(C)}>FELHASZNÁLÓNÉV</label>
          <input type="text" value={loginUser} onChange={e=>setLoginUser(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="pl. admin" style={{...inp(C),marginBottom:"12px"}}/>
          <label style={lbl(C)}>JELSZÓ</label>
          <input type="password" value={loginPw} onChange={e=>setLoginPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&login()} placeholder="Jelszó megadása..." style={inp(C,loginErr?C.red:null)}/>
          {loginErr && <p style={{color:C.red,fontSize:"12px",marginTop:"6px"}}>⚠ {loginErr}</p>}
          <button onClick={login} style={{width:"100%",padding:"11px",marginTop:"14px",backgroundColor:C.saveBg,color:C.saveText,border:"none",borderRadius:"9px",fontSize:"14px",fontWeight:"600",cursor:"pointer"}}>Belépés</button>
        </Overlay>
      )}

      {/* ── MUNKATÁRS MODAL ── */}
      {empModal && (
        <Overlay onClose={()=>setEmpModal(null)} C={C} wide noBackdropClose>
          <h2 style={{fontSize:"17px",fontWeight:"700",marginBottom:"20px",color:C.text}}>{empModal.id?"✏️  Munkatárs szerkesztése":"➕  Új munkatárs"}</h2>
          <EmpForm emp={empModal} units={units} labels={labels} onSave={saveEmp} onCancel={()=>setEmpModal(null)} C={C}/>
        </Overlay>
      )}

      {/* ── EGYSÉG MODAL ── */}
      {unitModal && (
        <Overlay onClose={()=>setUnitModal(null)} C={C}>
          <h2 style={{fontSize:"17px",fontWeight:"700",marginBottom:"20px",color:C.text}}>{unitModal.id?`${labels.units} átnevezése`:`Új ${labels.units.toLowerCase().replace(/[aáeéiíoóöőuúüű]k$/i,"")}`}</h2>
          <label style={lbl(C)}>{labels.units.toUpperCase()} NEVE</label>
          <input type="text" value={unitModal.name} onChange={e=>setUnitModal(u=>({...u,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&saveUnit(unitModal)} placeholder="pl. Marketing" style={inp(C)}/>
          <div style={{display:"flex",gap:"8px",marginTop:"18px",justifyContent:"flex-end"}}>
            <button onClick={()=>setUnitModal(null)} style={cancelBtn(C)}>Mégse</button>
            <button onClick={()=>saveUnit(unitModal)} disabled={!unitModal.name.trim()} style={{...saveBtn(C),opacity:unitModal.name.trim()?1:0.5}}>Mentés</button>
          </div>
        </Overlay>
      )}

      {/* ── MUNKATÁRS TÖRLÉS MODAL ── */}
      {deleteConfirm && (
        <Overlay onClose={()=>setDeleteConfirm(null)} C={C}>
          <div style={{textAlign:"center",marginBottom:"20px"}}>
            <div style={{width:"52px",height:"52px",backgroundColor:dark?"#3d1515":"#fee2e2",borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"24px",marginBottom:"14px"}}>🗑️</div>
            <h2 style={{fontSize:"17px",fontWeight:"700",color:C.text,marginBottom:"8px"}}>Végleges törlés</h2>
            <p style={{fontSize:"13.5px",color:C.textLight,lineHeight:"1.5"}}>Biztosan törlöd <b style={{color:C.text}}>{deleteConfirm.name}</b> adatait?</p>
            <p style={{fontSize:"12px",color:"#dc2626",marginTop:"8px",padding:"8px 12px",backgroundColor:dark?"#3d1515":"#fff5f5",borderRadius:"8px",border:`1px solid ${dark?"#7f1d1d":"#fecaca"}`}}>⚠ Ez a művelet nem visszavonható. Az archiválás megőrzi az adatokat.</p>
          </div>
          <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
            <button onClick={()=>setDeleteConfirm(null)} style={{...cancelBtn(C),padding:"10px 24px"}}>Mégse</button>
            <button onClick={()=>deleteEmployee(deleteConfirm.id)} style={{padding:"10px 24px",backgroundColor:"#dc2626",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13.5px",fontWeight:"700",cursor:"pointer",boxShadow:"0 2px 6px rgba(220,38,38,0.35)"}}>Törlés</button>
          </div>
        </Overlay>
      )}

      {/* ── EGYSÉG TÖRLÉS MODAL ── */}
      {deleteUnitConfirm && (() => {
        const affected = employees.filter(e=>e.unit_id===deleteUnitConfirm.id).length;
        return (
          <Overlay onClose={()=>setDeleteUnitConfirm(null)} C={C}>
            <div style={{textAlign:"center",marginBottom:"20px"}}>
              <div style={{width:"52px",height:"52px",backgroundColor:dark?"#3d1515":"#fee2e2",borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"24px",marginBottom:"14px"}}>🗑️</div>
              <h2 style={{fontSize:"17px",fontWeight:"700",color:C.text,marginBottom:"8px"}}>{labels.units} törlése</h2>
              <p style={{fontSize:"13.5px",color:C.textLight,lineHeight:"1.5"}}>Biztosan törlöd a <b style={{color:C.text}}>{deleteUnitConfirm.name}</b> {labels.units.toLowerCase().replace(/[aáeéiíoóöőuúüű]k$/i,"")}-t?</p>
            </div>
            {affected>0 ? (
              <div style={{padding:"13px 15px",backgroundColor:dark?"#2a1e00":"#fffbeb",border:`1px solid ${dark?"#92400e":"#fde68a"}`,borderRadius:"9px",marginBottom:"20px"}}>
                <p style={{fontSize:"13px",color:dark?"#fcd34d":"#92400e",fontWeight:"600",marginBottom:"6px"}}>⚠ {affected} munkatárs érinti ez a törlés</p>
                <p style={{fontSize:"12.5px",color:dark?"#fcd34d":"#78350f",lineHeight:"1.5"}}>Az érintett munkatársak <b>„{labels.units} nélkül"</b> csoportba kerülnek. Bármikor visszarendelheted őket.</p>
              </div>
            ) : (
              <div style={{padding:"10px 14px",backgroundColor:dark?"#1a1a0e":"#fffbeb",border:`1px solid ${dark?"#713f12":"#fde68a"}`,borderRadius:"9px",marginBottom:"20px"}}>
                <p style={{fontSize:"12px",color:dark?"#fcd34d":"#92400e"}}>⚠ Ez a művelet nem visszavonható.</p>
              </div>
            )}
            <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
              <button onClick={()=>setDeleteUnitConfirm(null)} style={{...cancelBtn(C),padding:"10px 24px"}}>Mégse</button>
              <button onClick={()=>deleteUnit(deleteUnitConfirm.id)} style={{padding:"10px 24px",backgroundColor:"#dc2626",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13.5px",fontWeight:"700",cursor:"pointer",boxShadow:"0 2px 6px rgba(220,38,38,0.35)"}}>{affected>0?"Igen, törlöm":"Törlés"}</button>
            </div>
          </Overlay>
        );
      })()}

      {/* ── CSOPORTOS TÖRLÉS MODAL ── */}
      {bulkDeleteConfirm && (
        <Overlay onClose={()=>setBulkDeleteConfirm(false)} C={C}>
          <div style={{textAlign:"center",marginBottom:"20px"}}>
            <div style={{width:"52px",height:"52px",backgroundColor:dark?"#3d1515":"#fee2e2",borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:"24px",marginBottom:"14px"}}>🗑️</div>
            <h2 style={{fontSize:"17px",fontWeight:"700",color:C.text,marginBottom:"8px"}}>Csoportos törlés</h2>
            <p style={{fontSize:"13.5px",color:C.textLight,lineHeight:"1.5"}}>
              Biztosan törlöd a kijelölt <b style={{color:C.text}}>{selectedIds.size} munkatárs</b> összes adatát?
            </p>
            <p style={{fontSize:"12px",color:"#dc2626",marginTop:"8px",padding:"8px 12px",backgroundColor:dark?"#3d1515":"#fff5f5",borderRadius:"8px",border:`1px solid ${dark?"#7f1d1d":"#fecaca"}`}}>
              ⚠ Ez a művelet nem visszavonható. Ha csak el szeretnéd rejteni őket, használd az Archiválást.
            </p>
          </div>
          <div style={{display:"flex",gap:"8px",justifyContent:"center"}}>
            <button onClick={()=>setBulkDeleteConfirm(false)} style={{...cancelBtn(C),padding:"10px 24px"}}>Mégse</button>
            <button onClick={async()=>{
              const ids=[...selectedIds]; const count=ids.length;
              for(const id of ids){
                try{ await call(`/api/employees/${id}`,"DELETE",null,token); setEmployees(p=>p.filter(e=>e.id!==id)); }catch{}
              }
              setSelectedIds(new Set()); setBulkDeleteConfirm(false);
              showToast(`${count} munkatárs törölve`);
            }} style={{padding:"10px 24px",backgroundColor:"#dc2626",color:"#fff",border:"none",borderRadius:"8px",fontSize:"13.5px",fontWeight:"700",cursor:"pointer",boxShadow:"0 2px 6px rgba(220,38,38,0.35)"}}>
              Törlés ({selectedIds.size} munkatárs)
            </button>
          </div>
        </Overlay>
      )}

      {/* ── IMPORT MODAL ── */}
      {importModal && (
        <Overlay onClose={()=>setImportModal(null)} C={C} wide>
          <div style={{marginBottom:"16px"}}>
            <h2 style={{fontSize:"17px",fontWeight:"700",color:C.text,marginBottom:"4px"}}>↑ CSV Import előnézet</h2>
            <p style={{fontSize:"12.5px",color:C.textMuted}}>
              <b style={{color:C.text}}>{importModal.rows.length} munkatárs</b> importálható. Ellenőrizd az adatokat, majd kattints az Importálásra.
            </p>
          </div>

          {importModal.warnings.length>0 && (
            <div style={{padding:"10px 14px",backgroundColor:dark?"#2a1e00":"#fffbeb",border:`1px solid ${dark?"#92400e":"#fde68a"}`,borderRadius:"8px",marginBottom:"12px",maxHeight:"100px",overflowY:"auto"}}>
              {importModal.warnings.map((w,i)=>(
                <div key={i} style={{fontSize:"11.5px",color:dark?"#fcd34d":"#92400e",marginBottom:"2px"}}>⚠ {w}</div>
              ))}
            </div>
          )}

          <div style={{maxHeight:"280px",overflowY:"auto",border:`1px solid ${C.cardBorder}`,borderRadius:"10px",marginBottom:"16px"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"12.5px"}}>
              <thead>
                <tr style={{backgroundColor:C.thBg,position:"sticky",top:0}}>
                  {["Név","Beosztás","Email","Egység"].map(h=>(
                    <th key={h} style={{padding:"8px 12px",textAlign:"left",color:C.thText,fontWeight:"700",fontSize:"10.5px",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importModal.rows.slice(0,5).map((emp,i)=>(
                  <tr key={i} style={{backgroundColor:i%2===0?C.cardBg:C.cardBg2,borderBottom:`1px solid ${C.tdBorder}`}}>
                    <td style={{padding:"7px 12px",color:C.text,fontWeight:"600"}}>{emp.name}</td>
                    <td style={{padding:"7px 12px",color:C.tdTextLight}}>{emp.position||<span style={{color:C.textMuted}}>—</span>}</td>
                    <td style={{padding:"7px 12px",color:C.blueText,fontSize:"12px"}}>{emp.email_1||<span style={{color:C.textMuted}}>—</span>}</td>
                    <td style={{padding:"7px 12px"}}>
                      {emp.unit_id
                        ? <span style={{backgroundColor:C.blueSoft,color:C.blueText,padding:"2px 8px",borderRadius:"20px",fontSize:"11.5px",fontWeight:"500"}}>{units.find(u=>u.id===emp.unit_id)?.name}</span>
                        : emp._dept
                          ? <span style={{backgroundColor:dark?"#2a1e00":"#fef3c7",color:"#d97706",padding:"2px 8px",borderRadius:"20px",fontSize:"11.5px"}} title="Nem található egyező egység">⚠ {emp._dept}</span>
                          : <span style={{color:C.textMuted,fontSize:"11.5px"}}>—</span>}
                    </td>
                  </tr>
                ))}
                {importModal.rows.length>5 && (
                  <tr><td colSpan={4} style={{padding:"8px 12px",textAlign:"center",color:C.textMuted,fontSize:"12px"}}>... és még {importModal.rows.length-5} névjegy</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
            <button onClick={()=>setImportModal(null)} style={cancelBtn(C)}>Mégse</button>
            <button onClick={doImport} disabled={importing} style={{...saveBtn(C),backgroundColor:"#16a34a",opacity:importing?0.6:1,display:"flex",alignItems:"center",gap:"6px"}}>
              {importing?"Importálás...":"↑ Importálás ("+importModal.rows.length+" fő)"}
            </button>
          </div>
        </Overlay>
      )}
      {/* ── FELHASZNÁLÓ MODAL ── */}
      {userModal && (
        <Overlay onClose={()=>setUserModal(null)} C={C}>
          <h2 style={{fontSize:"17px",fontWeight:"700",marginBottom:"6px",color:C.text}}>{userModal.id?"👤 Felhasználó szerkesztése":"👤 Új felhasználó"}</h2>
          {userModal.id && <p style={{fontSize:"12px",color:C.textMuted,marginBottom:"20px"}}>Jelszó mezőt üresen hagyva a jelenlegi jelszó megmarad.</p>}
          {!userModal.id && <div style={{height:"14px"}}/>}
          <label style={lbl(C)}>MEGJELENÍTETT NÉV <span style={{color:C.red}}>*</span></label>
          <input type="text" value={userModal.displayName} onChange={e=>setUserModal(u=>({...u,displayName:e.target.value}))} placeholder="pl. Kovács Péter" style={{...inp(C),marginBottom:"12px"}}/>
          <label style={lbl(C)}>FELHASZNÁLÓNÉV <span style={{color:C.red}}>*</span></label>
          <input type="text" value={userModal.username} onChange={e=>setUserModal(u=>({...u,username:e.target.value}))} placeholder="pl. kovacs.peter" style={{...inp(C),marginBottom:"12px"}}/>
          <label style={lbl(C)}>{userModal.id?"ÚJ JELSZÓ (opcionális)":<>JELSZÓ <span style={{color:C.red}}>*</span></>}</label>
          <input type="password" value={userModal.password} onChange={e=>setUserModal(u=>({...u,password:e.target.value}))} placeholder={userModal.id?"Üresen hagyva = nem változik":"Jelszó megadása..."} style={{...inp(C),marginBottom:"12px"}}/>
          <label style={lbl(C)}>SZEREPKÖR <span style={{color:C.red}}>*</span></label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"20px"}}>
            {[{v:"superadmin",l:"Főadmin",desc:"Teljes hozzáférés",icon:"⭐"},{v:"editor",l:"Szerkesztő",desc:"Munkatársak + egységek",icon:"✏️"}].map(r=>(
              <button key={r.v} onClick={()=>setUserModal(u=>({...u,role:r.v}))} style={{padding:"10px 12px",backgroundColor:userModal.role===r.v?(r.v==="superadmin"?"#fef3c7":C.blueSoft):C.cardBg,border:`2px solid ${userModal.role===r.v?(r.v==="superadmin"?"#f59e0b":C.blue):C.cardBorder}`,borderRadius:"9px",cursor:"pointer",textAlign:"left"}}>
                <div style={{fontSize:"16px",marginBottom:"3px"}}>{r.icon}</div>
                <div style={{fontWeight:"700",fontSize:"12.5px",color:C.text}}>{r.l}</div>
                <div style={{fontSize:"11px",color:C.textMuted,marginTop:"1px"}}>{r.desc}</div>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:"8px",justifyContent:"flex-end"}}>
            <button onClick={()=>setUserModal(null)} style={cancelBtn(C)}>Mégse</button>
            <button onClick={()=>{ if(userModal.displayName.trim()&&userModal.username.trim()&&(userModal.id||userModal.password.trim())) saveUser(userModal); }}
              disabled={!(userModal.displayName.trim()&&userModal.username.trim()&&(userModal.id||userModal.password.trim()))}
              style={{...saveBtn(C),opacity:(userModal.displayName.trim()&&userModal.username.trim()&&(userModal.id||userModal.password.trim()))?1:0.5}}>
              {userModal.id?"Mentés":"Létrehozás"}
            </button>
          </div>
        </Overlay>
      )}

      {/* ── TOAST ── */}
      {toast && (
        <div style={{position:"fixed",bottom:"24px",right:"24px",zIndex:2000,backgroundColor:toast.type==="success"?"#16a34a":"#dc2626",color:"#fff",padding:"12px 18px",borderRadius:"10px",boxShadow:"0 4px 16px rgba(0,0,0,0.2)",fontSize:"13.5px",fontWeight:"500",maxWidth:"340px",lineHeight:"1.4",animation:"slideUp 0.25s ease"}}>
          {toast.type==="success"?"✓ ":"⚠ "}{toast.message}
        </div>
      )}
    </div>
  );
}

// ─── Segédkomponensek ─────────────────────────────────────────────────────────
function Overlay({children,onClose,C,wide,noBackdropClose}){
  return (
    <div onClick={noBackdropClose?undefined:onClose} style={{position:"fixed",inset:0,backgroundColor:C.overlayBg,backdropFilter:"blur(3px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:"20px"}}>
      <div onClick={e=>e.stopPropagation()} style={{backgroundColor:C.modalBg,borderRadius:"16px",padding:"28px",width:wide?"580px":"360px",maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 64px rgba(0,0,0,0.25)"}}>
        {children}
      </div>
    </div>
  );
}

function EmpForm({emp,units,labels,onSave,onCancel,C}){
  const [form,setForm] = useState({...emp});
  const [errors,setErrors] = useState({});
  const set = k => e => { setForm(f=>({...f,[k]:e.target.value})); setErrors(er=>({...er,[k]:null})); };

  const validPhone = v => /^\+36\d{9}$/.test(fmtPhone((v||"").trim()));
  const validEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v||"").trim());

  const field = (label, fkey, type="text", placeholder="", required=false) => (
    <div style={{marginBottom:"13px"}}>
      <label style={lbl(C)}>{label}{required&&<span style={{color:C.red}}> *</span>}</label>
      <input type={type} value={form[fkey]||""} onChange={set(fkey)} placeholder={placeholder}
        style={inp(C, errors[fkey]?C.red:undefined)}/>
      {errors[fkey] && <div style={{color:C.red,fontSize:"11.5px",marginTop:"3px"}}>⚠ {errors[fkey]}</div>}
    </div>
  );

  const handleSave = () => {
    const newErrors = {};
    if (!form.name?.trim())     newErrors.name     = "Ez a mező kötelező";
    if (!form.position?.trim()) newErrors.position = "Ez a mező kötelező";
    if (!form.phone?.trim())          newErrors.phone    = "Ez a mező kötelező";
    else if (!validPhone(form.phone)) newErrors.phone    = "Érvénytelen formátum – pl. +36301234567";
    if (form.phone_2?.trim() && !validPhone(form.phone_2)) newErrors.phone_2 = "Érvénytelen formátum – pl. +36301234567";
    if (!form.email_1?.trim())          newErrors.email_1 = "Ez a mező kötelező";
    else if (!validEmail(form.email_1)) newErrors.email_1 = "Érvénytelen email cím";
    if (form.email_2?.trim() && !validEmail(form.email_2)) newErrors.email_2 = "Érvénytelen email cím";
    if (form.email_3?.trim() && !validEmail(form.email_3)) newErrors.email_3 = "Érvénytelen email cím";
    if (Object.keys(newErrors).length>0) { setErrors(newErrors); return; }
    onSave(form);
  };

  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 14px"}}>
        <div style={{gridColumn:"1 / -1"}}>{field("TELJES NÉV","name","text","Kovács Péter",true)}</div>
        {field("BEOSZTÁS","position","text","pl. Fejlesztő",true)}
        {field("TELEFONSZÁM","phone","tel","+36301234567",true)}
        {field("2. TELEFONSZÁM (opcionális)","phone_2","tel","+36301234567")}
        <div style={{gridColumn:"1 / -1",marginBottom:"13px"}}>
          <label style={lbl(C)}>{labels?.units?.toUpperCase() || "EGYSÉG"}</label>
          <select value={form.unit_id??""} onChange={e=>setForm(f=>({...f,unit_id:e.target.value===""?null:parseInt(e.target.value)}))} style={inp(C)}>
            {units.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            <option value="">— Nincs egység —</option>
          </select>
        </div>
        <div style={{gridColumn:"1 / -1"}}>{field("EMAIL CÍM 1","email_1","email","nev@vallalat.hu",true)}</div>
        {field("EMAIL CÍM 2","email_2","email","opcionális")}
        {field("EMAIL CÍM 3","email_3","email","opcionális")}
      </div>
      <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",marginTop:"6px"}}>
        <button onClick={onCancel} style={cancelBtn(C)}>Mégse</button>
        <button onClick={handleSave} style={saveBtn(C)}>{form.id?"Mentés":"Hozzáadás"}</button>
      </div>
    </div>
  );
}

// ─── Stílus helpek ────────────────────────────────────────────────────────────
const lbl = C=>({display:"block",fontSize:"10.5px",fontWeight:"700",color:C.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"5px"});
const inp = (C,borderColor)=>({width:"100%",padding:"9px 12px",border:`1px solid ${borderColor||C.inputBorder}`,borderRadius:"8px",fontSize:"13.5px",color:C.inputText,backgroundColor:C.inputBg,transition:"border-color 0.15s,box-shadow 0.15s"});
const cancelBtn = C=>({padding:"9px 20px",backgroundColor:C.cancelBg,color:C.cancelText,border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"500",cursor:"pointer"});
const saveBtn   = C=>({padding:"9px 22px",backgroundColor:C.saveBg,color:C.saveText,border:"none",borderRadius:"8px",fontSize:"13px",fontWeight:"600",cursor:"pointer"});
