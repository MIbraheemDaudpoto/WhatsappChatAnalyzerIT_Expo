import { useCallback, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import ExcelJS from "exceljs";
import { Download, Eye, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type ContactSubmission = {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAtUtc: string;
  metadata: {
    browser?: string;
    deviceType?: string;
  };
};

type ContactListResponse = {
  success: boolean;
  data: {
    data: ContactSubmission[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  message?: string;
};

type ContactStats = {
  total: number;
  today: number;
  week: number;
  month: number;
  averageMessageLength: number;
  topEmailDomains: Array<{ domain: string; count: number }>;
  browserDistribution: Array<{ label: string; count: number }>;
  deviceDistribution: Array<{ label: string; count: number }>;
};

const chartConfig = {
  count: {
    label: "Count",
    color: "#16a34a",
  },
};

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};

const exportToCsv = (rows: ContactSubmission[]) => {
  const headers = ["ID", "Name", "Email", "Subject", "Message", "Submitted UTC", "Browser", "Device"];
  const csvRows = rows.map((row) =>
    [
      row.id,
      row.name,
      row.email,
      row.subject,
      row.message,
      row.submittedAtUtc,
      row.metadata.browser || "",
      row.metadata.deviceType || "",
    ]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(","),
  );

  const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, `contact-submissions-${Date.now()}.csv`);
};

const exportToJson = (rows: ContactSubmission[]) => {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json;charset=utf-8" });
  downloadBlob(blob, `contact-submissions-${Date.now()}.json`);
};

const exportToPdf = (rows: ContactSubmission[]) => {
  const pdf = new jsPDF("p", "mm", "a4");
  let y = 12;

  pdf.setFontSize(16);
  pdf.text("Contact Submissions", 10, y);
  y += 8;

  pdf.setFontSize(10);

  rows.forEach((row, index) => {
    if (y > 275) {
      pdf.addPage();
      y = 12;
    }

    const block = `${index + 1}. ${row.name} (${row.email})\nSubject: ${row.subject || "N/A"}\nMessage: ${row.message}\nDate: ${row.submittedAtUtc}`;
    const lines = pdf.splitTextToSize(block, 190);
    pdf.text(lines, 10, y);
    y += lines.length * 5 + 2;
  });

  pdf.save(`contact-submissions-${Date.now()}.pdf`);
};

const exportToXlsx = async (rows: ContactSubmission[]) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Contact Submissions");

  worksheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Name", key: "name", width: 22 },
    { header: "Email", key: "email", width: 28 },
    { header: "Subject", key: "subject", width: 26 },
    { header: "Message", key: "message", width: 60 },
    { header: "Submitted UTC", key: "submittedAtUtc", width: 28 },
    { header: "Browser", key: "browser", width: 20 },
    { header: "Device", key: "device", width: 16 },
  ];

  rows.forEach((row) => {
    worksheet.addRow({
      ...row,
      browser: row.metadata.browser || "",
      device: row.metadata.deviceType || "",
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `contact-submissions-${Date.now()}.xlsx`);
};

const AdminContactDashboard = () => {
  const [apiKey, setApiKey] = useState(localStorage.getItem("adminApiKey") || "");
  const [draftApiKey, setDraftApiKey] = useState(localStorage.getItem("adminApiKey") || "");
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ContactSubmission | null>(null);

  const fetchSubmissions = useCallback(async () => {
    if (!apiKey) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const response = await fetch(`/api/contact?${params.toString()}`, {
        headers: { "x-api-key": apiKey },
      });

      const result = (await response.json()) as ContactListResponse;
      if (!response.ok || !result.success) {
        toast.error(result.message || "Unable to load submissions");
        return;
      }

      setSubmissions(result.data.data);
      setPage(result.data.page);
      setPageSize(result.data.pageSize);
      setTotalPages(result.data.totalPages);
      setTotal(result.data.total);
    } catch {
      toast.error("Unable to load submissions");
    } finally {
      setLoading(false);
    }
  }, [apiKey, dateFrom, dateTo, page, pageSize, search]);

  const fetchStats = useCallback(async () => {
    if (!apiKey) return;

    try {
      const response = await fetch("/api/contact/stats", {
        headers: { "x-api-key": apiKey },
      });

      const result = (await response.json()) as { success: boolean; data?: ContactStats; message?: string };
      if (!response.ok || !result.success || !result.data) {
        toast.error(result.message || "Unable to load contact analytics");
        return;
      }

      setStats(result.data);
    } catch {
      toast.error("Unable to load contact analytics");
    }
  }, [apiKey]);

  useEffect(() => {
    fetchSubmissions();
    fetchStats();
  }, [fetchSubmissions, fetchStats]);

  const applyApiKey = () => {
    setApiKey(draftApiKey.trim());
    localStorage.setItem("adminApiKey", draftApiKey.trim());
    setPage(1);
  };

  const deleteSubmission = async (id: number) => {
    if (!window.confirm("Delete this submission?")) return;

    try {
      const response = await fetch(`/api/contact/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });

      const result = (await response.json()) as { success?: boolean; message?: string };
      if (!response.ok || !result.success) {
        toast.error(result.message || "Delete failed");
        return;
      }

      toast.success("Submission deleted");
      await Promise.all([fetchSubmissions(), fetchStats()]);
    } catch {
      toast.error("Delete failed");
    }
  };

  const exportRows = async (format: "csv" | "json" | "pdf" | "xlsx") => {
    if (!apiKey) {
      toast.error("Enter admin API key first.");
      return;
    }

    try {
      const params = new URLSearchParams({ page: "1", pageSize: "100", search, dateFrom, dateTo });
      const response = await fetch(`/api/contact?${params.toString()}`, { headers: { "x-api-key": apiKey } });
      const result = (await response.json()) as ContactListResponse;

      if (!response.ok || !result.success) {
        toast.error(result.message || "Export failed");
        return;
      }

      const rows = result.data.data;
      if (!rows.length) {
        toast.info("No records to export.");
        return;
      }

      if (format === "csv") exportToCsv(rows);
      if (format === "json") exportToJson(rows);
      if (format === "pdf") exportToPdf(rows);
      if (format === "xlsx") await exportToXlsx(rows);

      toast.success(`Exported ${rows.length} records as ${format.toUpperCase()}.`);
    } catch {
      toast.error("Export failed");
    }
  };

  const domainRows = useMemo(() => stats?.topEmailDomains ?? [], [stats]);

  return (
    <div className="min-h-screen bg-[#ECE5DD] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Contact Admin Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <Input
                placeholder="Enter ADMIN_API_KEY"
                value={draftApiKey}
                onChange={(event) => setDraftApiKey(event.target.value)}
              />
              <Button onClick={applyApiKey}>Unlock Dashboard</Button>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name/email"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
              <Input
                type="number"
                min={1}
                max={100}
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Math.max(1, Math.min(100, Number(event.target.value) || 10)));
                  setPage(1);
                }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => exportRows("csv")}>
                <Download className="mr-2 h-4 w-4" /> CSV
              </Button>
              <Button variant="outline" onClick={() => exportRows("xlsx")}>
                <Download className="mr-2 h-4 w-4" /> Excel
              </Button>
              <Button variant="outline" onClick={() => exportRows("pdf")}>
                <Download className="mr-2 h-4 w-4" /> PDF
              </Button>
              <Button variant="outline" onClick={() => exportRows("json")}>
                <Download className="mr-2 h-4 w-4" /> JSON
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">Total submissions: {total}</p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{format(new Date(item.submittedAtUtc), "yyyy-MM-dd HH:mm")}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{item.subject || "-"}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{item.message}</TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedMessage(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteSubmission(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!submissions.length ? (
                  <TableRow>
                    <TableCell colSpan={6}>{loading ? "Loading..." : "No submissions found"}</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                  Previous
                </Button>
                <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-5">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Contact Requests</p><p className="text-2xl font-bold">{stats?.total ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Today</p><p className="text-2xl font-bold">{stats?.today ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">This Week</p><p className="text-2xl font-bold">{stats?.week ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">This Month</p><p className="text-2xl font-bold">{stats?.month ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Average Message Length</p><p className="text-2xl font-bold">{stats?.averageMessageLength ?? 0}</p></CardContent></Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Top Email Domains</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {domainRows.map((domain) => (
                  <li key={domain.domain} className="flex items-center justify-between rounded border p-2">
                    <span>{domain.domain}</span>
                    <span className="font-semibold">{domain.count}</span>
                  </li>
                ))}
                {!domainRows.length ? <li className="text-muted-foreground">No data yet</li> : null}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Browser Distribution</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={stats?.browserDistribution ?? []}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Device Distribution</CardTitle></CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <PieChart>
                  <Pie
                    data={stats?.deviceDistribution ?? []}
                    dataKey="count"
                    nameKey="label"
                    outerRadius={85}
                    fill="var(--color-count)"
                    label
                  />
                  <Tooltip />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={Boolean(selectedMessage)} onOpenChange={() => setSelectedMessage(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedMessage?.subject || "Message"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p><strong>Name:</strong> {selectedMessage?.name}</p>
            <p><strong>Email:</strong> {selectedMessage?.email}</p>
            <p className="whitespace-pre-wrap rounded border p-3">{selectedMessage?.message}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminContactDashboard;
