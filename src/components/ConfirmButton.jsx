import { useEffect, useState } from "react";

// A button that arms on first click (swapping its label/style briefly) and
// only fires onConfirm on a second click within armMs. Replaces browser-
// native confirm() dialogs with a consistent, in-app destructive-action
// pattern used across Year/Month/Bucket/Travel deletion.
export default function ConfirmButton({
  onConfirm,
  children,
  confirmLabel = "Confirm?",
  className = "",
  confirmClassName = "",
  armMs = 3000,
  title,
  confirmTitle,
  ...props
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), armMs);
    return () => clearTimeout(t);
  }, [armed, armMs]);

  const handleClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (armed) {
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={armed ? confirmClassName || className : className}
      title={armed ? confirmTitle || title : title}
      {...props}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
