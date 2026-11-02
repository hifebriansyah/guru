// A switch with its name: a click on the name works the switch too. The switch comes first, then the name.
import { useId } from "react";

export function TeacherSwitch({ name, on, onToggle }: { name: string; on: boolean; onToggle: () => void }) {
  const id = useId();
  return (
    <div className="row">
      <button type="button" id={id} role="switch" aria-checked={on} className="switch" onClick={onToggle} />
      <label htmlFor={id}>{name}</label>
    </div>
  );
}
