"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { QRCodeCanvas } from "qrcode.react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, Upload, Download, Link as LinkIcon, Star, StarOff, Trash2, Pencil, Tag, Filter, QrCode, LogOut, Shield, Database, Warehouse, MapPin, Users, ExternalLink, Copy, Eye
} from "lucide-react";

/*
  Pergudangan Link Hub – Versi Pro (App Router, single page)
  - Siap deploy di Vercel
  - Supabase Auth (email magic link) + DB + RLS
*/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
const supabase = (supabaseUrl && supabaseAnon) ? createClient(supabaseUrl, supabaseAnon) : null;

interface LinkItem {
  id: string;
  title: string;
  url: string;
  description: string | null;
  category: string | null;
  location: string | null;
  tags: string[] | null;
  favorite: boolean;
  clicks: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  email: string | null;
  role: "admin" | "staff";
  full_name: string | null;
  created_at: string;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
      {children}
    </span>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

function Button({
  icon: Icon,
  children,
  variant = "solid",
  className = "",
  ...rest
}: any) {
  const variants: Record<string, string> = {
    solid: "bg-black text-white hover:opacity-90",
    muted: "bg-gray-100 hover:bg-gray-200",
    outline: "border hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:opacity-90",
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border shadow-sm">{children}</div>;
}
function CardBody({ children, className = "" }: any) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
function CardHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle?: string;
  icon?: any;
}) {
  return (
    <div className="flex items-center gap-3 p-4 border-b">
      {Icon && <Icon className="shrink-0" />}
      <div>
        <div className="text-lg font-semibold">{title}</div>
        {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
      </div>
    </div>
  );
}

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/\"/g, '""')}"`;
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))];
  return lines.join("\n");
}

function parseCSV(text: string): any[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^\"|\"$/g, ""));
  return lines.slice(1).map(line => {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === ',' && !inQ) {
        cols.push(cur); cur = "";
      } else {
        cur += c;
      }
    }
    cols.push(cur);
    const obj: Record<string, any> = {};
    headers.forEach((h, i) => obj[h] = cols[i]?.replace(/^\"|\"$/g, ""));
    return obj;
  });
}

export default function PergudanganLinkHub() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [onlyFav, setOnlyFav] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const [loc, setLoc] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");

  const [editing, setEditing] = useState<LinkItem | null>(null);
  const [form, setForm] = useState<any>({
    title: "",
    url: "",
    description: "",
    category: "",
    location: "",
    tags: "",
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const canAdmin = profile?.role === "admin";

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) =>
      setSession(sess)
    );
    return () => {
      sub?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    if (!session) { setProfile(null); return; }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,role,full_name,created_at")
        .eq("id", session.user.id)
        .single();
      if (!error && data) setProfile(data as any);
    })();
  }, [session]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("links")
        .select("id,title,url,description,category,location,tags,favorite,clicks,created_by,created_at,updated_at")
        .order("updated_at", { ascending: false });
      if (!error && data) setLinks(data as any);
      setLoading(false);
    })();
  }, [session]);

  async function sendOtp() {
    if (!supabase) return alert("Supabase belum dikonfigurasi.");
    try {
      setIsSendingOtp(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (error) throw error;
      alert("Magic link terkirim! Cek email kamu.");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsSendingOtp(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setProfile(null);
  }

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return links.filter((l) => {
      if (onlyFav && !l.favorite) return false;
      if (cat && (l.category || "") !== cat) return false;
      if (loc && (l.location || "") !== loc) return false;
      if (tag && !(l.tags || []).includes(tag)) return false;
      if (!term) return true;
      const h = [l.title, l.url, l.description, l.category, l.location, (l.tags||[]).join(" ")].join(" ").toLowerCase();
      return h.includes(term);
    });
  }, [links, q, onlyFav, cat, loc, tag]);

  const categories = useMemo(() => Array.from(new Set(links.map(l => l.category).filter(Boolean))) as string[], [links]);
  const locations = useMemo(() => Array.from(new Set(links.map(l => l.location).filter(Boolean))) as string[], [links]);
  const allTags = useMemo(() => Array.from(new Set(links.flatMap(l => l.tags || []))) as string[], [links]);

  async function saveLink() {
    if (!supabase) return alert("Supabase belum dikonfigurasi.");
    const payload = {
      title: form.title?.trim(),
      url: form.url?.trim(),
      description: (form.description || null),
      category: (form.category || null),
      location: (form.location || null),
      tags: form.tags ? String(form.tags).split(",").map((s: string) => s.trim()).filter(Boolean) : null,
    };
    if (!payload.title || !payload.url) return alert("Judul & URL wajib diisi");

    if (editing) {
      const { data, error } = await supabase.from("links").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing.id).select().single();
      if (error) return alert(error.message);
      setLinks(prev => prev.map(x => x.id === editing.id ? (data as any) : x));
      await supabase.from("audit_logs").insert({ action: "update", link_id: editing.id, by: session?.user?.email || null });
    } else {
      const { data, error } = await supabase.from("links").insert({ ...payload, favorite: false, clicks: 0, created_by: session?.user?.id || null }).select().single();
      if (error) return alert(error.message);
      setLinks(prev => [data as any, ...prev]);
      await supabase.from("audit_logs").insert({ action: "create", link_id: (data as any).id, by: session?.user?.email || null });
    }
    setEditing(null);
    setForm({ title: "", url: "", description: "", category: "", location: "", tags: "" });
  }

  async function toggleFav(item: LinkItem) {
    if (!supabase) return;
    const { data, error } = await supabase.from("links").update({ favorite: !item.favorite }).eq("id", item.id).select().single();
    if (!error && data) setLinks(prev => prev.map(x => x.id === item.id ? (data as any) : x));
  }

  async function del(item: LinkItem) {
    if (!supabase) return;
    if (!confirm(`Hapus "${item.title}"?`)) return;
    const { error } = await supabase.from("links").delete().eq("id", item.id);
    if (!error) {
      setLinks(prev => prev.filter(x => x.id !== item.id));
      await supabase.from("audit_logs").insert({ action: "delete", link_id: item.id, by: session?.user?.email || null });
    }
  }

  async function recordClick(item: LinkItem) {
    if (!supabase) return;
    await supabase.from("links").update({ clicks: (item.clicks || 0) + 1 }).eq("id", item.id);
    await supabase.from("audit_logs").insert({ action: "clicked", link_id: item.id, by: session?.user?.email || null });
  }

  function startEdit(item?: LinkItem) {
    setEditing(item || null);
    setForm({
      title: item?.title || "",
      url: item?.url || "",
      description: item?.description || "",
      category: item?.category || "",
      location: item?.location || "",
      tags: (item?.tags || []).join(", "),
    });
  }

  async function importCSV(file: File) {
    const text = await file.text();
    const rows = parseCSV(text);
    const shaped = rows.map((r: any) => ({
      title: r.title || r.judul || r.name,
      url: r.url || r.link,
      description: r.description || r.deskripsi || null,
      category: r.category || r.kategori || null,
      location: r.location || r.lokasi || null,
      tags: r.tags ? String(r.tags).split("|").map((s: string) => s.trim()).filter(Boolean) : null,
      favorite: false,
      clicks: 0,
      created_by: session?.user?.id || null,
    })).filter((r: any) => r.title && r.url);
    if (!supabase) return alert("Supabase belum dikonfigurasi.");
    const { data, error } = await supabase.from("links").insert(shaped).select();
    if (error) return alert(error.message);
    setLinks(prev => [...(data as any), ...prev]);
  }

  function exportCSV() {
    const rows = links.map(({ id, created_at, updated_at, created_by, ...r }) => r);
    const csv = toCSV(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pergudangan-links.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const rows = links;
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pergudangan-links.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  const EmptyState = (
    <Card>
      <CardBody className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Warehouse size={40} />
        <div className="text-xl font-semibold">Belum ada link</div>
        <div className="text-sm text-gray-500 max-w-md">
          Tambahkan link spreadsheet untuk tim warehouse. Kamu bisa mengelompokkan berdasarkan kategori (contoh: Stok, Inbound, Outbound) dan lokasi gudang.
        </div>
        {canAdmin && (
          <Button icon={Plus} onClick={() => startEdit()} className="mt-2">Tambah link</Button>
        )}
      </CardBody>
    </Card>
  );

  if (!supabaseUrl || !supabaseAnon) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="mx-auto max-w-4xl p-6">
          <HeroHeader />
          <Card>
            <CardHeader title="Konfigurasi diperlukan" subtitle="Set NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY di Vercel env" icon={Shield} />
            <CardBody>
              <ul className="list-disc pl-5 text-sm text-gray-600 space-y-1">
                <li>Buat project Supabase → aktifkan Auth (email OTP).</li>
                <li>Jalankan SQL schema (lihat README).</li>
                <li>Deploy ke Vercel, isi env sesuai project Supabase.</li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="mx-auto max-w-xl p-6">
          <HeroHeader />
          <Card>
            <CardHeader title="Masuk ke Link Hub" subtitle="Login via email magic link" icon={Users} />
            <CardBody className="space-y-3">
              <label className="text-sm font-medium">Email karyawan</label>
              <Input type="email" placeholder="nama@perusahaan.com" value={email} onChange={e => setEmail(e.target.value)} />
              <Button onClick={sendOtp} disabled={!email || isSendingOtp} className="w-full" icon={Shield}>
                {isSendingOtp ? "Mengirim..." : "Kirim Magic Link"}
              </Button>
              <div className="text-xs text-gray-500">Setelah klik link di email, kamu akan otomatis masuk.</div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white to-gray-50">
      <TopNav onSignOut={signOut} profile={profile} />

      <main className="mx-auto max-w-7xl p-6">
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-500" size={18} />
              <Input placeholder="Cari judul, URL, tag, kategori..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="md:col-span-8 flex flex-wrap items-center gap-2">
            <Button variant={onlyFav ? "solid" : "outline"} icon={onlyFav ? Star : StarOff} onClick={() => setOnlyFav(v => !v)}>
              Favorit
            </Button>
            <div className="flex items-center gap-2">
              <Filter size={16} />
              <select className="rounded-xl border px-2 py-2 text-sm" value={cat || ""} onChange={e => setCat(e.target.value || null)}>
                <option value="">Kategori</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select className="rounded-xl border px-2 py-2 text-sm" value={loc || ""} onChange={e => setLoc(e.target.value || null)}>
                <option value="">Lokasi</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select className="rounded-xl border px-2 py-2 text-sm" value={tag || ""} onChange={e => setTag(e.target.value || null)}>
                <option value="">Tag</option>
                {allTags.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button variant={view === "cards" ? "solid" : "outline"} onClick={() => setView("cards")}>Kartu</Button>
              <Button variant={view === "table" ? "solid" : "outline"} onClick={() => setView("table")}>Tabel</Button>
              {canAdmin && (
                <>
                  <Button icon={Plus} onClick={() => startEdit()}>Tambah</Button>
                  <Button variant="outline" icon={Upload} onClick={() => fileRef.current?.click()}>Impor CSV</Button>
                  <input type="file" accept=".csv" ref={fileRef} hidden onChange={e => e.target.files && importCSV(e.target.files[0])} />
                  <Button variant="outline" icon={Download} onClick={exportCSV}>Ekspor CSV</Button>
                  <Button variant="outline" icon={Download} onClick={exportJSON}>Ekspor JSON</Button>
                </>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <Card><CardBody>Memuat...</CardBody></Card>
        ) : (
          filtered.length === 0 ? EmptyState : (
            view === "cards" ? <CardGrid items={filtered} onFav={toggleFav} onDel={del} onEdit={startEdit} onClickOpen={recordClick} canAdmin={canAdmin} /> :
            <CardTable items={filtered} onFav={toggleFav} onDel={del} onEdit={startEdit} onClickOpen={recordClick} canAdmin={canAdmin} />
          )
        )}

        <AnimatePresence>
          {editing && (
            <Modal onClose={() => setEditing(null)}>
              <Card>
                <CardHeader title={editing?.id ? "Edit Link" : "Tambah Link"} icon={LinkIcon} />
                <CardBody className="space-y-3 w-[min(640px,90vw)]">
                  <div>
                    <label className="text-sm font-medium">Judul</label>
                    <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">URL Spreadsheet</label>
                    <Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/..." />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Deskripsi</label>
                    <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium">Kategori</label>
                      <Input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Stok / Inbound / Outbound" />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Lokasi Gudang</label>
                      <Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Jakarta / Surabaya / dll" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Tag (pisahkan dengan koma)</label>
                    <Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="SKU, harian, safety-stock" />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
                    <Button onClick={saveLink} icon={Database}>{editing?.id ? "Simpan Perubahan" : "Simpan"}</Button>
                  </div>
                </CardBody>
              </Card>
            </Modal>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}

function TopNav({ onSignOut, profile }: { onSignOut: () => void, profile: Profile | null }) {
  return (
    <header className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white"><Warehouse size={18} /></div>
          <div>
            <div className="text-sm font-semibold">Pergudangan Link Hub</div>
            <div className="text-[11px] text-gray-500">Akses cepat database spreadsheet</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {profile && <Chip>{profile.role.toUpperCase()}</Chip>}
          <Button variant="outline" icon={LogOut} onClick={onSignOut}>Keluar</Button>
        </div>
      </div>
    </header>
  );
}

function CardGrid({ items, onFav, onDel, onEdit, onClickOpen, canAdmin }: any) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item: LinkItem) => (
        <motion.div key={item.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <a className="text-base font-semibold hover:underline" href={item.url} target="_blank" onClick={() => onClickOpen(item)}>
                      {item.title}
                    </a>
                    <ExternalLink size={14} className="text-gray-500" />
                  </div>
                  <div className="text-xs text-gray-500 break-all">{item.url}</div>
                </div>
                <button onClick={() => onFav(item)} className={`rounded-full p-2 ${item.favorite ? "text-yellow-500" : "text-gray-400"}`}>
                  <Star size={18} fill={item.favorite ? "currentColor" : "none"} />
                </button>
              </div>
              {item.description && <div className="text-sm text-gray-700">{item.description}</div>}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {item.category && <Chip><Tag size={12} className="mr-1" />{item.category}</Chip>}
                {item.location && <Chip><MapPin size={12} className="mr-1" />{item.location}</Chip>}
                {(item.tags || []).map((t: string) => <Chip key={t}>{t}</Chip>)}
                <Chip><Eye size={12} className="mr-1" />{item.clicks}</Chip>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" icon={Copy} onClick={() => navigator.clipboard.writeText(item.url)}>Salin</Button>
                  <QRPopover value={item.url} />
                </div>
                {canAdmin && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" icon={Pencil} onClick={() => onEdit(item)}>Edit</Button>
                    <Button variant="danger" icon={Trash2} onClick={() => onDel(item)}>Hapus</Button>
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function CardTable({ items, onFav, onDel, onEdit, onClickOpen, canAdmin }: any) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="p-3 text-left">Judul</th>
              <th className="p-3 text-left">Kategori</th>
              <th className="p-3 text-left">Lokasi</th>
              <th className="p-3 text-left">Tags</th>
              <th className="p-3 text-left">Klik</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: LinkItem) => (
              <tr key={item.id} className="border-b hover:bg-gray-50">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onFav(item)} className={`rounded-full p-1 ${item.favorite ? "text-yellow-500" : "text-gray-300"}`}>
                      <Star size={16} fill={item.favorite ? "currentColor" : "none"} />
                    </button>
                    <a className="font-medium hover:underline" href={item.url} target="_blank" onClick={() => onClickOpen(item)}>{item.title}</a>
                  </div>
                  <div className="text-[11px] text-gray-500 break-all">{item.url}</div>
                </td>
                <td className="p-3">{item.category || "-"}</td>
                <td className="p-3">{item.location || "-"}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {(item.tags || []).map((t: string) => <Chip key={t}>{t}</Chip>)}
                  </div>
                </td>
                <td className="p-3">{item.clicks}</td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="outline" icon={Copy} onClick={() => navigator.clipboard.writeText(item.url)}>Salin</Button>
                    <QRPopover value={item.url} />
                    {canAdmin && (
                      <>
                        <Button variant="outline" icon={Pencil} onClick={() => onEdit(item)}>Edit</Button>
                        <Button variant="danger" icon={Trash2} onClick={() => onDel(item)}>Hapus</Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Modal({ children, onClose }: any) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}>
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function QRPopover({ value }: { value: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <Button variant="outline" icon={QrCode} onClick={() => setOpen(v => !v)}>QR</Button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="absolute right-0 z-10 mt-2 rounded-2xl border bg-white p-3 shadow-xl">
            <div className="flex items-center justify-center p-2">
              <QRCodeCanvas value={value} size={140} includeMargin />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" icon={Copy} onClick={() => navigator.clipboard.writeText(value)} className="w-full">Salin Link</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroHeader() {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white shadow"><Warehouse /></div>
      <div>
        <div className="text-2xl font-bold">Pergudangan Link Hub</div>
        <div className="text-sm text-gray-600">Portal links spreadsheet tercantik se-jagat gudang ✨</div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer className="mx-auto max-w-7xl p-6 text-center text-xs text-gray-500">
      Dibuat penuh cinta untuk tim gudang • {new Date().getFullYear()} • Mode Pro
    </footer>
  );
}