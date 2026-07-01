import path from "node:path";

import {
  loadAnnualShowScheduleCsvFile,
  parseAnnualShowScheduleCsv,
  validateAnnualShowScheduleRows,
  type AnnualShowScheduleRow,
} from "./showScheduleCsv";

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

function assertThrows(action: () => unknown, label: string): void {
  try {
    action();
  } catch {
    return;
  }

  throw new Error(`${label}: expected validation to throw`);
}

function cloneRows(rows: AnnualShowScheduleRow[]): AnnualShowScheduleRow[] {
  return rows.map((row) => ({
    ...row,
    showDayOffsets: [...row.showDayOffsets],
    showDayNames: [...row.showDayNames],
  }));
}

function setRow(
  rows: AnnualShowScheduleRow[],
  weekInYear: number,
  slotIndex: number,
  update: Partial<AnnualShowScheduleRow>
): AnnualShowScheduleRow[] {
  return rows.map((row) =>
    row.weekInYear === weekInYear && row.slotIndex === slotIndex
      ? { ...row, ...update }
      : row
  );
}

const schedulePath = path.resolve(
  process.cwd(),
  "docs",
  "annual-show-schedule.csv"
);
const rows = loadAnnualShowScheduleCsvFile(schedulePath);
const validation = validateAnnualShowScheduleRows(rows);
const regularRows = validation.regularRows;
const reservedRows = validation.reservedRows;

assertEqual(rows.length, 154, "total CSV row count");
assertEqual(regularRows.length, 153, "regular annual row count");
assertEqual(reservedRows.length, 1, "reserved marker row count");
assertEqual(reservedRows[0]?.weekInYear, 52, "reserved marker week");
assertEqual(
  regularRows.filter((row) => row.clusterType === "FOUR_DAY").length,
  30,
  "FOUR_DAY regular row count"
);

const expectedWeeks = new Map([
  [1, "1,6,11"],
  [2, "2,7,12"],
  [3, "3,8,13"],
  [4, "4,9,14"],
  [5, "5,10,15"],
  [6, "1,6,11"],
  [17, "2,7,12"],
  [34, "4,9,14"],
  [51, "1,6,11"],
]);

for (const [weekInYear, expectedDistricts] of expectedWeeks.entries()) {
  const weekRows = regularRows
    .filter((row) => row.weekInYear === weekInYear)
    .sort((a, b) => (a.slotIndex ?? 0) - (b.slotIndex ?? 0));

  assertEqual(weekRows.length, 3, `week ${weekInYear} row count`);
  assertEqual(
    weekRows.map((row) => row.district).join(","),
    expectedDistricts,
    `week ${weekInYear} district circuit`
  );
}

assertEqual(
  regularRows.filter((row) => row.weekInYear === 52).length,
  0,
  "Week 52 regular row count"
);

for (let district = 1; district <= 15; district += 1) {
  const districtRows = regularRows.filter((row) => row.district === district);
  const expectedCount = district === 1 || district === 6 || district === 11
    ? 11
    : 10;

  assertEqual(
    districtRows.length,
    expectedCount,
    `district ${district} annual row count`
  );
  assertEqual(
    districtRows.filter((row) => row.clusterType === "FOUR_DAY").length,
    2,
    `district ${district} FOUR_DAY row count`
  );
}

assertThrows(() => {
  const invalidRows = cloneRows(rows);
  invalidRows[1] = {
    ...invalidRows[1]!,
    templateId: invalidRows[0]!.templateId,
  };
  validateAnnualShowScheduleRows(invalidRows);
}, "duplicate template IDs");

assertThrows(() => {
  validateAnnualShowScheduleRows(
    rows.filter(
      (row) => !(row.weekInYear === 17 && row.slotIndex === 3)
    )
  );
}, "missing week slot row");

assertThrows(() => {
  validateAnnualShowScheduleRows(
    setRow(cloneRows(rows), 1, 1, { district: 99 })
  );
}, "invalid district number");

assertThrows(() => {
  const invalidRows = cloneRows(rows).map((row) =>
    row.weekInYear === 52
      ? {
          ...row,
          slotIndex: 1,
          district: 1,
          clusterType: "TWO_DAY" as const,
          showDayOffsets: [5, 6],
          showDayNames: ["Saturday", "Sunday"],
          startDayOffset: 5,
          endDayOffset: 6,
          isRegularCircuit: true,
          isInvitationalReserved: false,
        }
      : row
  );
  validateAnnualShowScheduleRows(invalidRows);
}, "regular Week 52 rows");

assertThrows(() => {
  validateAnnualShowScheduleRows(
    setRow(cloneRows(rows), 1, 1, { showName: "" })
  );
}, "blank show names");

assertThrows(() => {
  parseAnnualShowScheduleCsv(
    "weekInYear,slotIndex,templateId,district,showName,clusterType,showDayOffsets,showDayNames,startDayOffset,endDayOffset,entryOpenLeadHours,entryCloseOffsetHours,isRegularCircuit,isInvitationalReserved,notes\n" +
      "1,1,week-1-slot-1,1,Bad Type,THREE_DAY,5|6,Saturday|Sunday,5,6,120,14,true,false,"
  );
}, "invalid clusterType values");

assertThrows(() => {
  validateAnnualShowScheduleRows(
    setRow(cloneRows(rows), 1, 1, { showDayOffsets: [5, 6] })
  );
}, "incorrect FOUR_DAY offset count");

assertThrows(() => {
  validateAnnualShowScheduleRows(
    setRow(cloneRows(rows), 2, 1, { showDayOffsets: [5] })
  );
}, "incorrect TWO_DAY offset count");

console.log("Annual show schedule CSV checks passed.");
