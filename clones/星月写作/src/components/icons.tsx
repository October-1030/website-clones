import type { SVGProps } from "react";

export function CartIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M5.588 21.413Q5 20.825 5 20t.588-1.412T7 18t1.413.588T9 20t-.587 1.413T7 22t-1.412-.587m10 0Q15 20.825 15 20t.588-1.412T17 18t1.413.588T19 20t-.587 1.413T17 22t-1.412-.587M6.15 6l2.4 5h7l2.75-5zM5.2 4h14.75q.575 0 .875.513t.025 1.037l-3.55 6.4q-.275.5-.737.775T15.55 13H8.1L7 15h12v2H7q-1.125 0-1.7-.987t-.05-1.963L6.6 11.6L3 4H1V2h3.25zm3.35 7h7z"></path></svg>;
}

export function WalletIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M12 2c.892 0 2.01.113 2.941.428c.464.156.95.386 1.336.733c.406.365.723.887.723 1.553c0 .641-.294 1.172-.646 1.566c-.195.218-.423.41-.666.58C18.674 8.283 21 11.334 21 15c0 2.556-1.02 4.386-2.767 5.525C16.56 21.617 14.33 22 12 22s-4.559-.383-6.233-1.475C4.02 19.386 3 17.555 3 15c0-3.665 2.326-6.717 5.312-8.14a4 4 0 0 1-.666-.58C7.294 5.886 7 5.355 7 4.714c0-.666.317-1.188.723-1.553c.386-.347.872-.577 1.336-.733C9.99 2.113 11.108 2 12 2m1.947 8.606a1 1 0 0 0-1.341.447L12 12.263l-.605-1.21a1 1 0 0 0-1.79.894L10.132 13H10a1 1 0 0 0 0 2h1v.5h-1a1 1 0 0 0 0 2h1v.5a1 1 0 1 0 2 0v-.5h1a1 1 0 1 0 0-2h-1V15h1a1 1 0 1 0 0-2h-.132l.527-1.053a1 1 0 0 0-.448-1.341M12 4c-.764 0-1.646.101-2.3.322c-.33.112-.534.23-.64.325a.3.3 0 0 0-.06.07c0 .014.012.09.138.23c.14.157.374.335.7.504c.66.342 1.504.549 2.162.549s1.501-.207 2.161-.549c.327-.17.561-.347.701-.504c.126-.14.136-.216.137-.23a.3.3 0 0 0-.06-.07c-.105-.094-.309-.213-.638-.325C13.646 4.102 12.764 4 12 4"></path></svg>;
}

export function ReceiptIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M17.44 2.065H6.56a2.507 2.507 0 0 0-2.5 2.5v14.87a2.507 2.507 0 0 0 2.5 2.5h10.88a2.5 2.5 0 0 0 2.5-2.5V4.565a2.5 2.5 0 0 0-2.5-2.5m1.5 17.37a1.5 1.5 0 0 1-1.5 1.5H6.56a1.5 1.5 0 0 1-1.5-1.5V6.505h13.88Z"></path><path fill="currentColor" d="M7.549 9.506a.5.5 0 0 1 0-1h8.909a.5.5 0 0 1 0 1Zm0 3a.5.5 0 0 1 0-1h6.5a.5.5 0 0 1 0 1Zm.017 5.868a.5.5 0 1 1 0-1h3.251a.5.5 0 0 1 0 1Z"></path></svg>;
}

export function BellIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M4 19v-2h2v-7q0-2.075 1.25-3.687T10.5 4.2v-.7q0-.625.438-1.062T12 2t1.063.438T13.5 3.5v.7q2 .5 3.25 2.113T18 10v7h2v2zm8 3q-.825 0-1.412-.587T10 20h4q0 .825-.587 1.413T12 22m-4-5h8v-7q0-1.65-1.175-2.825T12 6T9.175 7.175T8 10z"></path></svg>;
}

export function MailIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"><rect width="18.5" height="15.5" x="2.75" y="4.25" rx="3"></rect><path d="m2.75 8l8.415 3.866a2 2 0 0 0 1.67 0L21.25 8"></path></g></svg>;
}

export function HistoryIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M12 21q-3.45 0-6.012-2.287T3.05 13H5.1q.35 2.6 2.313 4.3T12 19q2.925 0 4.963-2.037T19 12t-2.037-4.962T12 5q-1.725 0-3.225.8T6.25 8H9v2H3V4h2v2.35q1.275-1.6 3.113-2.475T12 3q1.875 0 3.513.713t2.85 1.924t1.925 2.85T21 12t-.712 3.513t-1.925 2.85t-2.85 1.925T12 21m2.8-4.8L11 12.4V7h2v4.6l3.2 3.2z"></path></svg>;
}

export function PaletteIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M12 22q-2.05 0-3.875-.788t-3.187-2.15t-2.15-3.187T2 12q0-2.075.813-3.9t2.2-3.175T8.25 2.788T12.2 2q2 0 3.775.688t3.113 1.9t2.125 2.875T22 11.05q0 2.875-1.75 4.413T16 17h-1.85q-.225 0-.312.125t-.088.275q0 .3.375.863t.375 1.287q0 1.25-.687 1.85T12 22m-4.425-9.425Q8 12.15 8 11.5t-.425-1.075T6.5 10t-1.075.425T5 11.5t.425 1.075T6.5 13t1.075-.425m3-4Q11 8.15 11 7.5t-.425-1.075T9.5 6t-1.075.425T8 7.5t.425 1.075T9.5 9t1.075-.425m5 0Q16 8.15 16 7.5t-.425-1.075T14.5 6t-1.075.425T13 7.5t.425 1.075T14.5 9t1.075-.425m3 4Q19 12.15 19 11.5t-.425-1.075T17.5 10t-1.075.425T16 11.5t.425 1.075T17.5 13t1.075-.425M12 20q.225 0 .363-.125t.137-.325q0-.35-.375-.825T11.75 17.3q0-1.05.725-1.675T14.25 15H16q1.65 0 2.825-.962T20 11.05q0-3.025-2.312-5.038T12.2 4Q8.8 4 6.4 6.325T4 12q0 3.325 2.338 5.663T12 20"></path></svg>;
}

export function BooksIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 18 16" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M3.5 2h-3c-.275 0-.5.225-.5.5v11c0 .275.225.5.5.5h3c.275 0 .5-.225.5-.5v-11c0-.275-.225-.5-.5-.5M3 5H1V4h2zm5.5-3h-3c-.275 0-.5.225-.5.5v11c0 .275.225.5.5.5h3c.275 0 .5-.225.5-.5v-11c0-.275-.225-.5-.5-.5M8 5H6V4h2z"></path><path fill="currentColor" d="m11.954 2.773l-2.679 1.35a.5.5 0 0 0-.222.671l4.5 8.93a.5.5 0 0 0 .671.222l2.679-1.35a.5.5 0 0 0 .222-.671l-4.5-8.93a.5.5 0 0 0-.671-.222"></path><path fill="currentColor" d="M14.5 13.5a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0"></path></svg>;
}

export function IdeaIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><g fill="none"><path fill="currentColor" d="M12 7a5 5 0 0 0-2 9.584V19h4v-2.416A5.001 5.001 0 0 0 12 7"></path><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12h1m-3.5-6.5l1-1M12 3V2M5.5 5.5l-1-1M3 12H2m8 10h4m3-10a5 5 0 1 0-7 4.584V19h4v-2.416A5 5 0 0 0 17 12"></path></g></svg>;
}

export function WorkflowIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M1 3a2 2 0 0 1 2-2h6.5a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H7v4.063C7 16.355 7.644 17 8.438 17H12.5v-2.5a2 2 0 0 1 2-2H21a2 2 0 0 1 2 2V21a2 2 0 0 1-2 2h-6.5a2 2 0 0 1-2-2v-2.5H8.437A2.94 2.94 0 0 1 5.5 15.562V11.5H3a2 2 0 0 1-2-2Zm2-.5a.5.5 0 0 0-.5.5v6.5a.5.5 0 0 0 .5.5h6.5a.5.5 0 0 0 .5-.5V3a.5.5 0 0 0-.5-.5ZM14.5 14a.5.5 0 0 0-.5.5V21a.5.5 0 0 0 .5.5H21a.5.5 0 0 0 .5-.5v-6.5a.5.5 0 0 0-.5-.5Z"></path></svg>;
}

export function ScriptIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M8.45 17.975q.4 0 .575-.262t.225-.613q.05-.25.088-.5t.087-.55q.05-.275.113-.6t.137-.75q.575-.125 1.125-.212t1.075-.138q.575-.075 1.138-.112t1.087-.088q.125.6.263 1.075t.287.9q.2.575.438.95t.587.65t.763.3t.712-.225q.225-.175.225-.525t-.2-.875q-.125-.275-.213-.562t-.212-.588q-.125-.35-.225-.638t-.175-.562q.325-.025.587-.112t.438-.238t.263-.362t.087-.463q0-.275-.112-.462t-.338-.313t-.562-.162t-.763.012l-.1-.887q-.05-.437-.125-.888q-.075-.425-.137-.875t-.188-.875q-.15-.65-.425-1.112t-.625-.763q-.325-.275-.712-.412T12.775 6q-.55 0-1.05.225t-1 .675q-.275.275-.55.587t-.525.738q-.2-.15-.363-.2t-.362-.05q-.275 0-.463.15t-.187.5q0 .45-.05.9t-.15.9q-.125.65-.275 1.288T7.525 13q-.275.05-.488.138t-.362.187q-.2.125-.287.313t-.088.387q0 .175.05.325t.175.275t.3.188t.4.087q-.025.3-.037.563t-.013.512q0 .525.075.9t.225.625t.388.363t.587.112m1.775-5.575q.15-.575.35-1.112t.45-1.113q.4-.925.85-1.475t.8-.55q.275 0 .475.425t.325 1.275q.075.5.125 1.075T13.7 12q-.425.025-.875.063t-.875.087t-.862.113t-.863.137M4 22q-.825 0-1.412-.587T2 20V4q0-.825.588-1.412T4 2h16q.825 0 1.413.588T22 4v16q0 .825-.587 1.413T20 22zm0-2h16V4H4zm0 0V4z"></path></svg>;
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M2 21V9h5.5v12zm7.25 0V3h5.5v18zm7.25 0V11H22v10z"></path></svg>;
}

export function PromptIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M14 1.5a.5.5 0 0 0-1 0V2h-.5a.5.5 0 0 0 0 1h.5v.5a.5.5 0 0 0 1 0V3h.5a.5.5 0 0 0 0-1H14zm-8.61.63a.2.2 0 0 1 .06-.104C5.474 2.002 5.493 2 5.5 2s.026.002.052.026a.2.2 0 0 1 .059.104a4.2 4.2 0 0 0 1.135 2.124A4.2 4.2 0 0 0 8.87 5.39a.2.2 0 0 1 .104.059c.024.025.026.044.026.051s-.002.026-.026.052a.2.2 0 0 1-.104.058a4.2 4.2 0 0 0-2.124 1.137A4.2 4.2 0 0 0 5.611 8.87a.2.2 0 0 1-.059.104c-.026.024-.044.026-.051.026c-.008 0-.026-.002-.052-.026a.2.2 0 0 1-.058-.104a4.2 4.2 0 0 0-1.137-2.124A4.2 4.2 0 0 0 2.13 5.61a.2.2 0 0 1-.103-.059C2.003 5.526 2 5.507 2 5.501c0-.008.002-.026.026-.052a.2.2 0 0 1 .104-.059a4.2 4.2 0 0 0 2.123-1.136A4.2 4.2 0 0 0 5.391 2.13M5.5 1c-.576 0-.99.453-1.088.926a3.2 3.2 0 0 1-.865 1.62a3.2 3.2 0 0 1-1.62.865c-.473.098-.927.513-.926 1.091c.001.576.454.989.926 1.087c.426.088 1.067.31 1.62.864s.776 1.195.865 1.621c.098.473.512.926 1.089.926s.99-.454 1.089-.927c.088-.425.31-1.066.864-1.62a3.2 3.2 0 0 1 1.62-.864C9.547 6.491 10 6.077 10 5.5s-.453-.99-.926-1.09a3.2 3.2 0 0 1-1.62-.863a3.2 3.2 0 0 1-.864-1.62C6.49 1.452 6.078 1 5.5 1m5.44 4a2.1 2.1 0 0 1 0 1h.56A1.5 1.5 0 0 1 13 7.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 6 11.5v-.56a2.1 2.1 0 0 1-1 0v.56A2.5 2.5 0 0 0 7.5 14h4a2.5 2.5 0 0 0 2.5-2.5v-4A2.5 2.5 0 0 0 11.5 5zM8 8.5a.5.5 0 0 1 .5-.5H11a.5.5 0 0 1 0 1H8.5a.5.5 0 0 1-.5-.5m.5 1.5a.5.5 0 0 0 0 1H10a.5.5 0 0 0 0-1zm-6 2a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 0 1H3v.5a.5.5 0 0 1-1 0V14h-.5a.5.5 0 0 1 0-1H2v-.5a.5.5 0 0 1 .5-.5"></path></svg>;
}

export function KnowledgeIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M11 14h2q.425 0 .713-.288T14 13t-.288-.712T13 12h-2q-.425 0-.712.288T10 13t.288.713T11 14m0-3h6q.425 0 .713-.288T18 10t-.288-.712T17 9h-6q-.425 0-.712.288T10 10t.288.713T11 11m0-3h6q.425 0 .713-.288T18 7t-.288-.712T17 6h-6q-.425 0-.712.288T10 7t.288.713T11 8M8 18q-.825 0-1.412-.587T6 16V4q0-.825.588-1.412T8 2h12q.825 0 1.413.588T22 4v12q0 .825-.587 1.413T20 18zm0-2h12V4H8zm-4 6q-.825 0-1.412-.587T2 20V7q0-.425.288-.712T3 6t.713.288T4 7v13h13q.425 0 .713.288T18 21t-.288.713T17 22zM8 4v12z"></path></svg>;
}

export function CourseIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M11.3 20q.15.5.413 1.038t.537.962H5q-.825 0-1.412-.587T3 20V4q0-.825.588-1.412T5 2h12q.825 0 1.413.588T19 4v7.1q-.45-.05-1-.05t-1 .05V4h-5v7L9.5 9.5L7 11V4H5v16zm3.163 1.538Q13 20.075 13 18t1.463-3.537T18 13t3.538 1.463T23 18t-1.463 3.538T18 23t-3.537-1.463M16.75 20.5l4-2.5l-4-2.5zM7 4h5zm4.3 0H5h12h-6z"></path></svg>;
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 48 48" width="1em" height="1em" aria-hidden="true" {...props}><defs><mask id="iconifyVue7"><g fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4"><circle cx="24" cy="12" r="8" fill="#555"></circle><path d="M42 44c0-9.941-8.059-18-18-18S6 34.059 6 44"></path></g></mask></defs><path fill="currentColor" d="M0 0h48v48H0z" mask="url(#iconifyVue7)"></path></svg>;
}

export function ForumIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M9 5a4 4 0 0 1 4 4a4 4 0 0 1-4 4a4 4 0 0 1-4-4a4 4 0 0 1 4-4m0 10c2.67 0 8 1.34 8 4v2H1v-2c0-2.66 5.33-4 8-4m7.76-9.64c2.02 2.2 2.02 5.25 0 7.27l-1.68-1.69c.84-1.18.84-2.71 0-3.89zM20.07 2c3.93 4.05 3.9 10.11 0 14l-1.63-1.63c2.77-3.18 2.77-7.72 0-10.74z"></path></svg>;
}

export function InfoIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0m-9-3.75h.008v.008H12z"></path></svg>;
}

export function CollapseIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" {...props}><path d="M5.64645 3.14645C5.45118 3.34171 5.45118 3.65829 5.64645 3.85355L9.79289 8L5.64645 12.1464C5.45118 12.3417 5.45118 12.6583 5.64645 12.8536C5.84171 13.0488 6.15829 13.0488 6.35355 12.8536L10.8536 8.35355C11.0488 8.15829 11.0488 7.84171 10.8536 7.64645L6.35355 3.14645C6.15829 2.95118 5.84171 2.95118 5.64645 3.14645Z" fill="currentColor"></path></svg>;
}

export function CloseIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 12 12" width="1em" height="1em" aria-hidden="true" {...props}><g stroke="none" strokeWidth="1" fill="none" fillRule="evenodd"><g fill="currentColor" fillRule="nonzero"><path d="M2.08859116,2.2156945 L2.14644661,2.14644661 C2.32001296,1.97288026 2.58943736,1.95359511 2.7843055,2.08859116 L2.85355339,2.14644661 L6,5.293 L9.14644661,2.14644661 C9.34170876,1.95118446 9.65829124,1.95118446 9.85355339,2.14644661 C10.0488155,2.34170876 10.0488155,2.65829124 9.85355339,2.85355339 L6.707,6 L9.85355339,9.14644661 C10.0271197,9.32001296 10.0464049,9.58943736 9.91140884,9.7843055 L9.85355339,9.85355339 C9.67998704,10.0271197 9.41056264,10.0464049 9.2156945,9.91140884 L9.14644661,9.85355339 L6,6.707 L2.85355339,9.85355339 C2.65829124,10.0488155 2.34170876,10.0488155 2.14644661,9.85355339 C1.95118446,9.65829124 1.95118446,9.34170876 2.14644661,9.14644661 L5.293,6 L2.14644661,2.85355339 C1.97288026,2.67998704 1.95359511,2.41056264 2.08859116,2.2156945 L2.14644661,2.14644661 L2.08859116,2.2156945 Z"></path></g></g></svg>;
}

export function AlertIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 28 28" width="1em" height="1em" aria-hidden="true" {...props}><g stroke="none" strokeWidth="1" fillRule="evenodd"><g fillRule="nonzero"><path d="M14,2 C20.6274,2 26,7.37258 26,14 C26,20.6274 20.6274,26 14,26 C7.37258,26 2,20.6274 2,14 C2,7.37258 7.37258,2 14,2 Z M14,11 C13.4477,11 13,11.4477 13,12 L13,12 L13,20 C13,20.5523 13.4477,21 14,21 C14.5523,21 15,20.5523 15,20 L15,20 L15,12 C15,11.4477 14.5523,11 14,11 Z M14,6.75 C13.3096,6.75 12.75,7.30964 12.75,8 C12.75,8.69036 13.3096,9.25 14,9.25 C14.6904,9.25 15.25,8.69036 15.25,8 C15.25,7.30964 14.6904,6.75 14,6.75 Z"></path></g></g></svg>;
}

export function LibraryIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M21 4H7a2 2 0 1 0 0 4h14v13a1 1 0 0 1-1 1H7a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h13a1 1 0 0 1 1 1zM5 18a2 2 0 0 0 2 2h12V10H7a4 4 0 0 1-2-.535zM20 7H7a1 1 0 0 1 0-2h13z"></path></svg>;
}

export function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M3 10H2V4.003C2 3.449 2.455 3 2.992 3h18.016A.99.99 0 0 1 22 4.003V10h-1v10.002a.996.996 0 0 1-.993.998H3.993A.996.996 0 0 1 3 20.002zm16 0H5v9h14zM4 5v3h16V5zm5 7h6v2H9z"></path></svg>;
}

export function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M17 6h5v2h-2v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8H2V6h5V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1zm1 2H6v12h12zm-9 3h2v6H9zm4 0h2v6h-2zM9 4v2h6V4z"></path></svg>;
}

export function FolderIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M14 16h2v-2h2v-2h-2v-2h-2v2h-2v2h2zM4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h6l2 2h8q.825 0 1.413.588T22 8v10q0 .825-.587 1.413T20 20z"></path></svg>;
}

export function GridIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M3 11V3h8v8zm0 10v-8h8v8zm10-10V3h8v8zm0 10v-8h8v8z"></path></svg>;
}

export function CompactIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M7.5 16.5h4v-4h-4zm0-5h4v-4h-4zm5 5h4v-4h-4zm0-5h4v-4h-4zM4 20q-.825 0-1.412-.587T2 18V6q0-.825.588-1.412T4 4h16q.825 0 1.413.588T22 6v12q0 .825-.587 1.413T20 20zm0-2h16V6H4zm0 0V6z"></path></svg>;
}

export function ListIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M7 9V7h14v2zm0 4v-2h14v2zm0 4v-2h14v2zM4 9q-.425 0-.712-.288T3 8t.288-.712T4 7t.713.288T5 8t-.288.713T4 9m0 4q-.425 0-.712-.288T3 12t.288-.712T4 11t.713.288T5 12t-.288.713T4 13m0 4q-.425 0-.712-.288T3 16t.288-.712T4 15t.713.288T5 16t-.288.713T4 17"></path></svg>;
}

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="m19.6 21l-6.3-6.3q-.75.6-1.725.95T9.5 16q-2.725 0-4.612-1.888T3 9.5t1.888-4.612T9.5 3t4.613 1.888T16 9.5q0 1.1-.35 2.075T14.7 13.3l6.3 6.3zM9.5 14q1.875 0 3.188-1.312T14 9.5t-1.312-3.187T9.5 5T6.313 6.313T5 9.5t1.313 3.188T9.5 14"></path></svg>;
}

export function ChecklistIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M5.55 19L2 15.45l1.4-1.4l2.125 2.125l4.25-4.25l1.4 1.425zm0-8L2 7.45l1.4-1.4l2.125 2.125l4.25-4.25l1.4 1.425zM13 17v-2h9v2zm0-8V7h9v2z"></path></svg>;
}

export function PlusCircleIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 256 256" width="1em" height="1em" aria-hidden="true" {...props}><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"><circle cx="128" cy="128" r="112"></circle><path d="M 79.999992,128 H 176.0001"></path><path d="m 128.00004,79.99995 v 96.0001"></path></g></svg>;
}

export function SmallPlusIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 256 256" width="1em" height="1em" aria-hidden="true" {...props}><g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16"><circle cx="128" cy="128" r="112"></circle><path d="M 79.999992,128 H 176.0001"></path><path d="m 128.00004,79.99995 v 96.0001"></path></g></svg>;
}

export function ImportIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 36 36" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M28 4H14.87L8 10.86V15h2v-1.39h7.61V6H28v24H8a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m-12 8h-6v-.32L15.7 6h.3Z"></path><path fill="currentColor" d="M11.94 26.28a1 1 0 1 0 1.41 1.41L19 22l-5.68-5.68a1 1 0 0 0-1.41 1.41L15.2 21H3a1 1 0 1 0 0 2h12.23Z"></path><path fill="none" d="M0 0h36v36H0z"></path></svg>;
}

export function ChevronIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"></path></svg>;
}

export function MoreChevronIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"></path></svg>;
}

export function GiftIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M19 19H5V8h14m-3-7v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14a2 2 0 0 0 2 2h14c1.11 0 2-.89 2-2V5a2 2 0 0 0-2-2h-1V1m-7.12 11H7.27l2.92 2.11l-1.11 3.45L12 15.43l2.92 2.13l-1.12-3.44L16.72 12h-3.6L12 8.56z"></path></svg>;
}

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M4 11v2h12l-5.5 5.5l1.42 1.42L19.84 12l-7.92-7.92L10.5 5.5L16 11z"></path></svg>;
}

export function PinIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 256 256" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="m235.33 104l-53.47 53.65c4.56 12.67 6.45 33.89-13.19 60A15.93 15.93 0 0 1 157 224h-1.13a16 16 0 0 1-11.32-4.69L96.29 171l-42.63 42.66a8 8 0 0 1-11.32-11.32L85 159.71l-48.3-48.3A16 16 0 0 1 38 87.63c25.42-20.51 49.75-16.48 60.4-13.14L152 20.7a16 16 0 0 1 22.63 0l60.69 60.68a16 16 0 0 1 .01 22.62"></path></svg>;
}

export function SecondPinIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 256 256" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="m235.33 104l-53.47 53.65c4.56 12.67 6.45 33.89-13.19 60A15.93 15.93 0 0 1 157 224h-1.13a16 16 0 0 1-11.32-4.69L96.29 171l-42.63 42.66a8 8 0 0 1-11.32-11.32L85 159.71l-48.3-48.3A16 16 0 0 1 38 87.63c25.42-20.51 49.75-16.48 60.4-13.14L152 20.7a16 16 0 0 1 22.63 0l60.69 60.68a16 16 0 0 1 .01 22.62"></path></svg>;
}

export function DownIcon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" {...props}><path fill="currentColor" d="M8.59 16.58L13.17 12L8.59 7.41L10 6l6 6l-6 6z"></path></svg>;
}
