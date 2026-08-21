"use client";

import {
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  GripVertical,
  ListTodo,
  LoaderCircle,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import type { CalendarEvent, EventHistory, EventParticipant, TeamMember } from "./expansion-modules";
import { CENTRAL_TIME_ZONE, parseCentralWallDateTime, toCentralDate, toCentralDateTime } from "./timezone";

export type ScheduledTask = {
  id:number;
  title:string;
  description:string;
  responsible:string;
  dueDate:string;
  startAt:string;
  endAt:string;
  allDay:boolean;
  calendarColor:string;
  reminderMinutes:number;
  priority:string;
  status:string;
  leadId:number|null;
  updatedBy:string;
};

type LeadFollowup = { id:number; name:string; company:string; nextFollowup:string; responsible:string; status:string };
type CalendarItem = {
  key:string;
  kind:"event"|"task"|"followup";
  title:string;
  startAt:string;
  endAt:string;
  color:string;
  ownerId:number|null;
  category:string;
  status:string;
  reminderMinutes:number;
  recurringOccurrence:boolean;
  event?:CalendarEvent;
  task?:ScheduledTask;
};

const pad=(value:number)=>String(value).padStart(2,"0");
const localDateTime=(date:Date)=>toCentralDateTime(date);
const dateOnly=(date:Date)=>toCentralDate(date);
const addDays=(date:Date,amount:number)=>{const next=new Date(date);next.setDate(next.getDate()+amount);return next;};
const startOfWeek=(date:Date)=>addDays(new Date(date.getFullYear(),date.getMonth(),date.getDate()),-date.getDay());
const timeLabel=(value:string)=>value?.slice(11,16)||"09:00";
const formatLong=(date:Date)=>new Intl.DateTimeFormat("pt-BR",{weekday:"long",day:"numeric",month:"long",timeZone:CENTRAL_TIME_ZONE}).format(date);

const wallDate=(value:string)=>{const [date,time="00:00"]=value.split("T");const[year,month,day]=date.split("-").map(Number);const[hour,minute]=time.split(":").map(Number);return new Date(Date.UTC(year,month-1,day,hour,minute));};
const wallValue=(date:Date)=>`${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
function shiftRecurrence(value:string,recurrence:string,amount:number){const date=wallDate(value);if(recurrence==="Diária")date.setUTCDate(date.getUTCDate()+amount);if(recurrence==="Semanal")date.setUTCDate(date.getUTCDate()+(7*amount));if(recurrence==="Mensal")date.setUTCMonth(date.getUTCMonth()+amount);return date;}
function recurringTimes(event:CalendarEvent,cursor:Date){
  if(!["Diária","Semanal","Mensal"].includes(event.recurrence))return[{startAt:event.startAt,endAt:event.endAt,recurringOccurrence:false}];
  const base=wallDate(event.startAt);const duration=Math.max(0,wallDate(event.endAt).getTime()-base.getTime());
  const rangeStart=new Date(Date.UTC(cursor.getFullYear(),cursor.getMonth()-1,1));const rangeEnd=new Date(Date.UTC(cursor.getFullYear(),cursor.getMonth()+2,1));
  const unit=event.recurrence==="Diária"?86400000:event.recurrence==="Semanal"?7*86400000:0;
  const approximate=unit?Math.max(0,Math.floor((rangeStart.getTime()-base.getTime())/unit)-1):Math.max(0,(rangeStart.getUTCFullYear()-base.getUTCFullYear())*12+rangeStart.getUTCMonth()-base.getUTCMonth()-1);
  const occurrences:{startAt:string;endAt:string;recurringOccurrence:boolean}[]=[];
  for(let index=approximate;index<approximate+120;index+=1){const start=shiftRecurrence(event.startAt,event.recurrence,index);if(start>rangeEnd)break;if(start>=rangeStart&&start>=base)occurrences.push({startAt:wallValue(start),endAt:wallValue(new Date(start.getTime()+duration)),recurringOccurrence:index>0});}
  return occurrences;
}

function Header({actions}:{actions:ReactNode}) {
  return <div className="section-header"><div><span className="eyebrow">AGENDA COLABORATIVA</span><h1>Calendário</h1><p>Tarefas e compromissos com horários reais, editáveis no próprio calendário.</p></div><div className="section-actions">{actions}</div></div>;
}

export function NativeCalendar({
  teamMembers,calendarEvents,eventParticipants,eventHistory,tasks,leads,currentMemberId,refresh,notify,
}:{
  teamMembers:TeamMember[];
  calendarEvents:CalendarEvent[];
  eventParticipants:EventParticipant[];
  eventHistory:EventHistory[];
  tasks:ScheduledTask[];
  leads:LeadFollowup[];
  currentMemberId:number|null;
  refresh:()=>Promise<void>|void;
  notify:(message:string)=>void;
}) {
  const [cursor,setCursor]=useState(new Date());
  const [view,setView]=useState<"month"|"week"|"day"|"agenda">("month");
  const [owners,setOwners]=useState<number[]>([]);
  const [sheet,setSheet]=useState<{kind:"event"|"task";date:string;event?:CalendarEvent;task?:ScheduledTask}|null>(null);
  const [saving,setSaving]=useState(false);
  useEffect(()=>{
    const query=window.matchMedia("(max-width: 620px)");
    const frame=window.requestAnimationFrame(()=>{if(query.matches)setView("agenda");});
    return()=>window.cancelAnimationFrame(frame);
  },[]);
  const members=teamMembers.filter((member)=>member.status==="Ativo");
  const memberMap=useMemo(()=>new Map(teamMembers.map((member)=>[member.id,member])),[teamMembers]);
  const items=useMemo<CalendarItem[]>(()=>[
    ...calendarEvents.flatMap((event)=>recurringTimes(event,cursor).map((occurrence)=>({key:`event-${event.id}-${occurrence.startAt}`,kind:"event" as const,title:event.title,startAt:occurrence.startAt,endAt:occurrence.endAt,color:event.color||memberMap.get(event.ownerId)?.color||"#6d5dfc",ownerId:event.ownerId,category:event.recurrence==="Nenhuma"?event.category:`${event.category} · ${event.recurrence}`,status:event.status,reminderMinutes:event.reminderMinutes,recurringOccurrence:occurrence.recurringOccurrence,event}))),
    ...tasks.filter((task)=>task.startAt||task.dueDate).map((task)=>{const owner=teamMembers.find((member)=>member.name===task.responsible);const start=task.startAt||`${task.dueDate}T09:00`;return{key:`task-${task.id}`,kind:"task" as const,title:task.title,startAt:start,endAt:task.endAt||`${task.dueDate}T10:00`,color:task.calendarColor||owner?.color||"#db8a19",ownerId:owner?.id||null,category:"Tarefa",status:task.status,reminderMinutes:task.reminderMinutes,recurringOccurrence:false,task};}),
    ...leads.filter((lead)=>lead.nextFollowup&&!["Ganho","Perdido"].includes(lead.status)).map((lead)=>{const owner=teamMembers.find((member)=>member.name===lead.responsible);return{key:`followup-${lead.id}`,kind:"followup" as const,title:`Follow-up: ${lead.name}`,startAt:`${lead.nextFollowup}T10:00`,endAt:`${lead.nextFollowup}T10:30`,color:owner?.color||"#3478eb",ownerId:owner?.id||null,category:"Follow-up",status:lead.status,reminderMinutes:0,recurringOccurrence:false};}),
  ].filter((item)=>!owners.length||(item.ownerId!==null&&owners.includes(item.ownerId))).sort((a,b)=>a.startAt.localeCompare(b.startAt)),[calendarEvents,tasks,leads,teamMembers,memberMap,owners,cursor]);

  const openNew=(date:string,hour=9,kind:"event"|"task"="task")=>setSheet({kind,date:`${date}T${pad(hour)}:00`});
  const openItem=(item:CalendarItem)=>{
    if(item.kind==="followup"){notify("Este follow-up é editado na aba Follow-ups.");return;}
    if(item.event){if(item.recurringOccurrence)notify("Esta ocorrência pertence a uma série; a edição altera a série completa.");setSheet({kind:"event",date:item.event.startAt,event:item.event});}
    if(item.task)setSheet({kind:"task",date:item.startAt,task:item.task});
  };
  const closeSheet=()=>{if(!saving)setSheet(null);};
  const changePeriod=(direction:number)=>setCursor((current)=>view==="month"?new Date(current.getFullYear(),current.getMonth()+direction,1):addDays(current,direction*(view==="week"?7:1)));
  const periodLabel=view==="month"?new Intl.DateTimeFormat("pt-BR",{month:"long",year:"numeric"}).format(cursor):formatLong(cursor);

  async function request(method:"POST"|"PATCH"|"DELETE",payload:Record<string,unknown>) {
    const response=await fetch("/api/workspace",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const result=await response.json() as {error?:string;code?:string};
    return {response,result};
  }

  async function save(kind:"event"|"task",payload:Record<string,unknown>,allowConflict=false) {
    setSaving(true);
    try {
      if(kind==="event"){
        const editing=sheet?.event;
        const {response,result}=await request(editing?"PATCH":"POST",{entity:"calendarEvent",...(editing?{id:editing.id,version:editing.version}:{}),...payload,allowConflict});
        if(response.status===409&&result.code==="CALENDAR_CONFLICT"&&!allowConflict){
          if(window.confirm(`${result.error}\n\nSalvar mesmo assim?`))return save(kind,payload,true);
          return;
        }
        if(!response.ok)throw new Error(result.error||"Não foi possível salvar o evento.");
      } else {
        const editing=sheet?.task;
        const {response,result}=await request(editing?"PATCH":"POST",{entity:"task",...(editing?{id:editing.id}:{}),...payload,dueDate:String(payload.startAt||"").slice(0,10)});
        if(!response.ok)throw new Error(result.error||"Não foi possível salvar a tarefa.");
      }
      await refresh();
      setSheet(null);
      notify(kind==="task"?"Tarefa salva e atualizada no calendário.":"Evento salvo e sincronizado.");
    } catch(error) {
      notify(error instanceof Error?error.message:"Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const entity=sheet?.kind==="task"?"task":"calendarEvent";
    const record=sheet?.task||sheet?.event;
    if(!record||!window.confirm(`Excluir “${record.title}”?`))return;
    setSaving(true);
    try {
      const {response,result}=await request("DELETE",{entity,id:record.id});
      if(!response.ok)throw new Error(result.error||"Não foi possível excluir.");
      await refresh();setSheet(null);notify(sheet?.kind==="task"?"Tarefa excluída.":"Evento excluído.");
    } catch(error) { notify(error instanceof Error?error.message:"Erro ao excluir."); }
    finally { setSaving(false); }
  }

  async function moveItem(item:CalendarItem,targetDate:string) {
    if(item.kind==="followup")return;
    const originalStart=parseCentralWallDateTime(item.startAt);
    const originalEnd=parseCentralWallDateTime(item.endAt);
    const duration=Math.max(30*60000,originalEnd.getTime()-originalStart.getTime());
    const startAt=`${targetDate}T${timeLabel(item.startAt)}`;
    const endAt=localDateTime(new Date(parseCentralWallDateTime(startAt).getTime()+duration));
    try {
      if(item.kind==="task"&&item.task){
        const {response,result}=await request("PATCH",{entity:"task",id:item.task.id,startAt,endAt,dueDate:targetDate});
        if(!response.ok)throw new Error(result.error||"Não foi possível mover a tarefa.");
      }
      if(item.kind==="event"&&item.event){
        let {response,result}=await request("PATCH",{entity:"calendarEvent",id:item.event.id,version:item.event.version,startAt,endAt});
        if(response.status===409&&result.code==="CALENDAR_CONFLICT"&&window.confirm(`${result.error}\n\nMover mesmo assim?`))({response,result}=await request("PATCH",{entity:"calendarEvent",id:item.event.id,version:item.event.version,startAt,endAt,allowConflict:true}));
        if(!response.ok)throw new Error(result.error||"Não foi possível mover o evento.");
      }
      await refresh();notify(item.kind==="task"?"Tarefa movida para o novo dia.":"Evento movido.");
    } catch(error) { notify(error instanceof Error?error.message:"Erro ao mover."); }
  }

  const upcoming=items.find((item)=>{const delta=parseCentralWallDateTime(item.startAt).getTime()-Date.now();return item.reminderMinutes>0&&delta>=0&&delta<=item.reminderMinutes*60000;});
  return <>
    <Header actions={<><button className="secondary-button" onClick={()=>{setCursor(new Date());setView("day");setOwners(currentMemberId?[currentMemberId]:[]);}}>Hoje</button><button className="secondary-button calendar-new-task" onClick={()=>openNew(dateOnly(new Date()),9,"task")}><ListTodo size={16}/>Nova tarefa</button><button className="primary-button" onClick={()=>openNew(dateOnly(new Date()),9,"event")}><Plus size={17}/>Novo evento</button></>}/>
    {upcoming&&<div className="native-reminder"><Bell size={17}/><div><strong>{upcoming.title}</strong><span>Começa às {timeLabel(upcoming.startAt)} · lembrete de {upcoming.reminderMinutes} min</span></div><button onClick={()=>openItem(upcoming)}>Abrir</button></div>}
    <div className="native-calendar-toolbar panel">
      <div><button aria-label="Período anterior" onClick={()=>changePeriod(-1)}><ChevronLeft size={18}/></button><button onClick={()=>setCursor(new Date())}>Hoje</button><button aria-label="Próximo período" onClick={()=>changePeriod(1)}><ChevronRight size={18}/></button><strong>{periodLabel}</strong></div>
      <nav>{([['month','Mês'],['week','Semana'],['day','Dia'],['agenda','Lista']] as const).map(([value,label])=><button className={view===value?"active":""} key={value} onClick={()=>setView(value)}>{label}</button>)}</nav>
    </div>
    <div className="native-member-strip panel"><button className={!owners.length?"active":""} onClick={()=>setOwners([])}><UsersRound size={14}/>Equipe</button>{members.map((member)=><button className={owners.includes(member.id)?"active":""} key={member.id} onClick={()=>setOwners((current)=>current.includes(member.id)?current.filter((id)=>id!==member.id):[...current,member.id])}><i style={{background:member.color}}/>{member.name}</button>)}<span><RefreshCw size={12}/>Sincronização automática · Horário de Brasília</span></div>
    <section className="native-calendar panel">
      {view==="month"&&<MonthView cursor={cursor} items={items} openNew={openNew} openItem={openItem} moveItem={moveItem}/>} 
      {view==="week"&&<WeekView cursor={cursor} items={items} openNew={openNew} openItem={openItem} moveItem={moveItem}/>} 
      {view==="day"&&<DayView cursor={cursor} items={items} openNew={openNew} openItem={openItem}/>} 
      {view==="agenda"&&<AgendaView cursor={cursor} items={items} openItem={openItem}/>} 
    </section>
    <div className="calendar-legend"><span><i className="task"/>Tarefas</span><span><i className="event"/>Eventos</span><span><i className="followup"/>Follow-ups</span><small>Arraste um bloco para mudar de dia ou toque para editar.</small></div>
    {sheet&&<CalendarSheet item={sheet} members={members} participants={sheet.event?eventParticipants.filter((participant)=>participant.eventId===sheet.event!.id).map((participant)=>participant.memberId):[]} history={sheet.event?eventHistory.filter((entry)=>entry.eventId===sheet.event!.id):[]} currentMemberId={currentMemberId} saving={saving} close={closeSheet} save={save} remove={remove}/>} 
  </>;
}

function DraggableItem({item,openItem}:{item:CalendarItem;openItem:(item:CalendarItem)=>void}) {
  return <button className={`native-item ${item.kind} ${item.status==="Concluída"||item.status==="Concluído"?"completed":""}`} style={{borderLeftColor:item.color}} draggable={item.kind!=="followup"&&!item.recurringOccurrence} onDragStart={(event)=>event.dataTransfer.setData("text/calendar-item",item.key)} onClick={(event)=>{event.stopPropagation();openItem(item);}}><span>{item.kind==="task"?<CheckCircle2 size={11}/>:item.kind==="event"?<CalendarDays size={11}/>:<RefreshCw size={11}/>}</span><b>{timeLabel(item.startAt)}</b><strong>{item.title}</strong>{item.recurringOccurrence?<RefreshCw aria-label="Evento recorrente" size={11}/>:<GripVertical size={11}/>}</button>;
}

function MonthView({cursor,items,openNew,openItem,moveItem}:{cursor:Date;items:CalendarItem[];openNew:(date:string,hour?:number,kind?:"event"|"task")=>void;openItem:(item:CalendarItem)=>void;moveItem:(item:CalendarItem,date:string)=>void}) {
  const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);const start=addDays(first,-first.getDay());const cells=Array.from({length:42},(_,index)=>addDays(start,index));
  return <div className="native-month"><header>{["DOM","SEG","TER","QUA","QUI","SEX","SÁB"].map((day)=><span key={day}>{day}</span>)}</header><div>{cells.map((date)=>{const iso=dateOnly(date);const dayItems=items.filter((item)=>item.startAt.slice(0,10)===iso);return <article className={`${date.getMonth()!==cursor.getMonth()?"outside":""} ${iso===dateOnly(new Date())?"today":""}`} key={iso} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{const key=event.dataTransfer.getData("text/calendar-item");const item=items.find((candidate)=>candidate.key===key);if(item)moveItem(item,iso);}} onClick={()=>openNew(iso,9,"task")}><time>{date.getDate()}</time><div>{dayItems.slice(0,4).map((item)=><DraggableItem key={item.key} item={item} openItem={openItem}/>)}{dayItems.length>4&&<small>+{dayItems.length-4} compromissos</small>}</div></article>;})}</div></div>;
}

function WeekView({cursor,items,openNew,openItem,moveItem}:{cursor:Date;items:CalendarItem[];openNew:(date:string,hour?:number,kind?:"event"|"task")=>void;openItem:(item:CalendarItem)=>void;moveItem:(item:CalendarItem,date:string)=>void}) {
  const start=startOfWeek(cursor);const days=Array.from({length:7},(_,index)=>addDays(start,index));
  return <div className="native-week"><header>{days.map((date)=><button className={dateOnly(date)===dateOnly(new Date())?"today":""} key={dateOnly(date)} onClick={()=>openNew(dateOnly(date),9,"task")}><span>{new Intl.DateTimeFormat("pt-BR",{weekday:"short"}).format(date)}</span><strong>{date.getDate()}</strong></button>)}</header><div>{days.map((date)=>{const iso=dateOnly(date);const dayItems=items.filter((item)=>item.startAt.slice(0,10)===iso);return <section key={iso} onDragOver={(event)=>event.preventDefault()} onDrop={(event)=>{const key=event.dataTransfer.getData("text/calendar-item");const item=items.find((candidate)=>candidate.key===key);if(item)moveItem(item,iso);}}>{Array.from({length:13},(_,index)=>index+7).map((hour)=><div className="week-hour" key={hour} onClick={()=>openNew(iso,hour,"task")}><time>{pad(hour)}:00</time>{dayItems.filter((item)=>Number(item.startAt.slice(11,13))===hour).map((item)=><DraggableItem key={item.key} item={item} openItem={openItem}/>)}</div>)}</section>;})}</div></div>;
}

function DayView({cursor,items,openNew,openItem}:{cursor:Date;items:CalendarItem[];openNew:(date:string,hour?:number,kind?:"event"|"task")=>void;openItem:(item:CalendarItem)=>void}) {
  const iso=dateOnly(cursor);const dayItems=items.filter((item)=>item.startAt.slice(0,10)===iso);
  return <div className="native-day"><header><div><span>{new Intl.DateTimeFormat("pt-BR",{weekday:"long"}).format(cursor)}</span><strong>{cursor.getDate()}</strong></div><p>Toque em um horário para criar uma tarefa.</p></header>{Array.from({length:17},(_,index)=>index+6).map((hour)=><div className="day-hour" key={hour} onClick={()=>openNew(iso,hour,"task")}><time>{pad(hour)}:00</time><div>{dayItems.filter((item)=>Number(item.startAt.slice(11,13))===hour).map((item)=><DraggableItem key={item.key} item={item} openItem={openItem}/>)}</div></div>)}</div>;
}

function AgendaView({cursor,items,openItem}:{cursor:Date;items:CalendarItem[];openItem:(item:CalendarItem)=>void}) {
  const start=`${cursor.getFullYear()}-${pad(cursor.getMonth()+1)}-01`;const end=dateOnly(new Date(cursor.getFullYear(),cursor.getMonth()+1,0));const monthItems=items.filter((item)=>item.startAt.slice(0,10)>=start&&item.startAt.slice(0,10)<=end);
  const groups=Array.from(new Set(monthItems.map((item)=>item.startAt.slice(0,10))));
  return groups.length?<div className="native-agenda">{groups.map((date)=><section key={date}><header><strong>{Number(date.slice(8,10))}</strong><span>{new Intl.DateTimeFormat("pt-BR",{weekday:"long",month:"long",timeZone:CENTRAL_TIME_ZONE}).format(parseCentralWallDateTime(`${date}T12:00`))}</span></header>{monthItems.filter((item)=>item.startAt.slice(0,10)===date).map((item)=><button key={item.key} onClick={()=>openItem(item)}><i style={{background:item.color}}/><time>{timeLabel(item.startAt)}</time><div><strong>{item.title}</strong><span>{item.category} · {item.status}</span></div><ChevronRight size={16}/></button>)}</section>)}</div>:<div className="native-empty"><CalendarDays size={28}/><strong>Nenhum compromisso neste mês</strong><span>Crie uma tarefa ou um evento para começar.</span></div>;
}

function CalendarSheet({item,members,participants,history,currentMemberId,saving,close,save,remove}:{item:{kind:"event"|"task";date:string;event?:CalendarEvent;task?:ScheduledTask};members:TeamMember[];participants:number[];history:EventHistory[];currentMemberId:number|null;saving:boolean;close:()=>void;save:(kind:"event"|"task",payload:Record<string,unknown>)=>void;remove:()=>void}) {
  const [kind,setKind]=useState(item.kind);
  const record=item.event||item.task;
  const startAt=item.event?.startAt||item.task?.startAt||item.date;
  const endAt=item.event?.endAt||item.task?.endAt||localDateTime(new Date(parseCentralWallDateTime(startAt).getTime()+60*60000));
  const ownerId=item.event?.ownerId||currentMemberId||members[0]?.id||1;
  const responsible=item.task?.responsible||members.find((member)=>member.id===ownerId)?.name||"";
  const submit=(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    if(kind==="task")save("task",{title:form.get("title"),description:form.get("description"),responsible:form.get("responsible"),startAt:form.get("startAt"),endAt:form.get("endAt"),allDay:form.get("allDay")==="on",calendarColor:form.get("color"),reminderMinutes:Number(form.get("reminderMinutes")),priority:form.get("priority"),status:form.get("status")});
    else save("event",{title:form.get("title"),description:form.get("description"),startAt:form.get("startAt"),endAt:form.get("endAt"),allDay:form.get("allDay")==="on",ownerId:Number(form.get("ownerId")),visibility:form.get("visibility"),category:form.get("category"),color:form.get("color"),location:form.get("location"),meetingLink:form.get("meetingLink"),recurrence:form.get("recurrence"),reminderMinutes:Number(form.get("reminderMinutes")),status:form.get("status"),participantIds:form.getAll("participantIds").map(Number)});
  };
  return <div className="calendar-sheet-layer" role="dialog" aria-modal="true"><button className="calendar-sheet-scrim" onClick={close}/><div className="calendar-sheet"><header><button className="sheet-close" onClick={close}><X size={19}/></button><div><span>{record?"EDITAR NO CALENDÁRIO":"NOVO HORÁRIO"}</span><h2>{record?.title||"Adicionar ao calendário"}</h2></div>{record&&<button className="sheet-delete" onClick={remove}><Trash2 size={17}/></button>}</header><form onSubmit={submit}>{!record&&<div className="calendar-kind-toggle"><button type="button" className={kind==="task"?"active":""} onClick={()=>setKind("task")}><ListTodo size={15}/>Tarefa</button><button type="button" className={kind==="event"?"active":""} onClick={()=>setKind("event")}><CalendarDays size={15}/>Evento</button></div>}<label className="sheet-title"><i style={{background:item.task?.calendarColor||item.event?.color||"#db8a19"}}/><input name="title" defaultValue={record?.title||""} placeholder={kind==="task"?"Nome da tarefa":"Título do evento"} autoFocus required/></label><div className="sheet-time-grid"><label><Clock3 size={16}/><span>Começa</span><input name="startAt" type="datetime-local" defaultValue={startAt.slice(0,16)} required/></label><label><Clock3 size={16}/><span>Termina</span><input name="endAt" type="datetime-local" defaultValue={endAt.slice(0,16)} required/></label></div><label className="sheet-switch"><input name="allDay" type="checkbox" defaultChecked={record?.allDay}/><span>Dia inteiro</span></label>{kind==="task"?<><div className="sheet-row"><label><UsersRound size={16}/><span>Responsável</span><select name="responsible" defaultValue={responsible}>{members.map((member)=><option key={member.id}>{member.name}</option>)}</select></label><label><Circle size={16}/><span>Prioridade</span><select name="priority" defaultValue={item.task?.priority||"Média"}><option>Baixa</option><option>Média</option><option>Alta</option><option>Urgente</option></select></label></div><div className="sheet-row"><label><CheckCircle2 size={16}/><span>Status</span><select name="status" defaultValue={item.task?.status||"A fazer"}><option>A fazer</option><option>Em andamento</option><option>Concluída</option></select></label><label><Bell size={16}/><span>Lembrete</span><ReminderSelect value={item.task?.reminderMinutes}/></label></div></>:<><div className="sheet-row"><label><UsersRound size={16}/><span>Responsável</span><select name="ownerId" defaultValue={ownerId}>{members.map((member)=><option value={member.id} key={member.id}>{member.name}</option>)}</select></label><label><Circle size={16}/><span>Categoria</span><select name="category" defaultValue={item.event?.category||"Reunião"}>{["Reunião","Ligação","Follow-up","Proposta","Pessoal","Outro"].map((value)=><option key={value}>{value}</option>)}</select></label></div><div className="sheet-row"><label><Bell size={16}/><span>Lembrete</span><ReminderSelect value={item.event?.reminderMinutes}/></label><label><UsersRound size={16}/><span>Visibilidade</span><select name="visibility" defaultValue={item.event?.visibility||"Equipe"}><option>Equipe</option><option>Privado</option></select></label></div><div className="sheet-row"><label><RefreshCw size={16}/><span>Recorrência</span><select name="recurrence" defaultValue={item.event?.recurrence||"Nenhuma"}><option>Nenhuma</option><option>Diária</option><option>Semanal</option><option>Mensal</option></select></label><label><CheckCircle2 size={16}/><span>Status</span><select name="status" defaultValue={item.event?.status||"Agendado"}><option>Agendado</option><option>Confirmado</option><option>Concluído</option><option>Cancelado</option></select></label></div><label className="sheet-link"><MapPin size={16}/><input name="location" defaultValue={item.event?.location||""} placeholder="Local ou endereço"/></label><label className="sheet-link"><CalendarDays size={16}/><input name="meetingLink" type="url" defaultValue={item.event?.meetingLink||""} placeholder="Link da reunião"/></label><fieldset className="sheet-participants"><legend>Participantes</legend>{members.map((member)=><label key={member.id}><input name="participantIds" type="checkbox" value={member.id} defaultChecked={participants.includes(member.id)||member.id===ownerId}/><i style={{background:member.color}}/>{member.name}</label>)}</fieldset></>}<label className="sheet-color"><span>Cor no calendário</span><input name="color" type="color" defaultValue={item.task?.calendarColor||item.event?.color||members.find((member)=>member.id===ownerId)?.color||"#db8a19"}/></label><label className="sheet-notes"><span>Notas</span><textarea name="description" defaultValue={record?.description||""} placeholder="Adicione detalhes importantes…"/></label>{history.length>0&&<div className="sheet-history"><strong>Alterações recentes</strong>{history.slice(0,3).map((entry)=><span key={entry.id}>{entry.actor} {entry.action}</span>)}</div>}<footer><button type="button" onClick={close}>Cancelar</button><button className="primary-button" disabled={saving}>{saving?<LoaderCircle className="spin" size={16}/>:<Check size={16}/>}Salvar</button></footer></form></div></div>;
}

function ReminderSelect({value=15}:{value?:number}) {
  return <select name="reminderMinutes" defaultValue={value}><option value="0">Nenhum</option><option value="5">5 min antes</option><option value="15">15 min antes</option><option value="30">30 min antes</option><option value="60">1 hora antes</option></select>;
}
