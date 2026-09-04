"use client";

import { type ReactNode, useId, useState } from "react";

type Selection =
  | "callName"
  | "registerName"
  | "moveRun"
  | "rehome"
  | "breed"
  | "breedingParticipation"
  | "grooming"
  | "shows"
  | "market"
  | null;

type Props = {
  dogName: string;
  callName: ReactNode;
  registerName: ReactNode;
  moveRun: ReactNode;
  rehome: ReactNode;
  breed: ReactNode;
  breedingParticipation: ReactNode;
  grooming: ReactNode;
  shows: ReactNode;
  showsCount: number;
  stud: ReactNode;
  market: ReactNode;
  marketLabel: string;
};

function Choice({ label, onClick, detail, isExpanded, controls }: { label: string; onClick: () => void; detail?: ReactNode; isExpanded: boolean; controls: string }) {
  return <button type="button" onClick={onClick} aria-expanded={isExpanded} aria-controls={controls} className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{label}{detail}</button>;
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return <section><h3 className="theme-label text-xs font-semibold uppercase tracking-[0.16em]">{title}</h3><div className="mt-2 flex flex-wrap gap-2">{children}</div></section>;
}

export default function ManageDogPanel(props: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Selection>(null);
  const panelId = useId();
  const detailId = useId();
  const choice = (label: string, selection: Exclude<Selection, null>, detail?: ReactNode) => <Choice label={label} onClick={() => setSelected(selection)} detail={detail} isExpanded={selected === selection} controls={detailId} />;
  const detail = selected ? <div id={detailId} className="dog-card mt-5 rounded-2xl p-4"><button type="button" onClick={() => setSelected(null)} className="theme-secondary-button mb-3 rounded-lg px-3 py-1.5 text-sm font-semibold">Back</button>{selected === "callName" ? props.callName : selected === "registerName" ? props.registerName : selected === "moveRun" ? props.moveRun : selected === "rehome" ? props.rehome : selected === "breed" ? props.breed : selected === "breedingParticipation" ? props.breedingParticipation : selected === "grooming" ? props.grooming : selected === "shows" ? props.shows : props.market}</div> : null;

  return <><button type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={() => { setIsOpen((open) => !open); setSelected(null); }} className="theme-secondary-button rounded-xl px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">Manage Dog</button>{isOpen ? <section id={panelId} aria-label="Manage Dog" className="theme-panel basis-full rounded-2xl p-5 lg:absolute lg:right-0 lg:top-full lg:z-10 lg:mt-3 lg:w-[min(42rem,calc(100vw-3rem))]"><div className="flex items-start justify-between gap-4"><div><p className="theme-label text-xs font-semibold uppercase tracking-[0.18em]">Administrative actions</p><h2 className="theme-heading mt-1 text-xl font-semibold">Manage {props.dogName}</h2></div><button type="button" onClick={() => { setIsOpen(false); setSelected(null); }} className="theme-secondary-button rounded-lg px-3 py-1.5 text-sm font-semibold">Close</button></div><div className="mt-5 grid gap-x-7 gap-y-5 sm:grid-cols-2"><Group title="Identity">{choice("Edit call name", "callName")}{props.registerName ? choice("Register name", "registerName") : null}</Group><Group title="Kennel">{choice("Move to another run", "moveRun")}{props.rehome ? choice("Re-home", "rehome") : null}</Group><Group title="Breeding">{choice("Breed", "breed")}{props.breedingParticipation ? choice("Breeding participation", "breedingParticipation") : null}</Group>{props.grooming ? <Group title="Grooming">{choice("Manage Grooming", "grooming")}</Group> : null}<div className="sm:col-span-2"><Group title="Shows">{choice("Manage Shows", "shows", <span className="theme-label ml-2 text-xs">{props.showsCount} current entries</span>)}</Group></div>{props.stud ? <Group title="Stud">{props.stud}</Group> : null}{props.market ? <Group title="Market">{choice(props.marketLabel, "market")}</Group> : null}</div>{detail}</section> : null}</>;
}
