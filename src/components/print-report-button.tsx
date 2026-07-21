"use client";

export function PrintReportButton() {
  return <button className="print-report-button" onClick={() => window.print()} type="button">Print this page</button>;
}
