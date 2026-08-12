import type { SkillCompanies } from "@/lib/skills/getSkillCompanies";

// A small inline note under a skill: which companies it was weak vs strong at.
// Renders nothing if there's no company info. Caps the list so it stays tidy.
export function SkillCompanyNote({ companies }: { companies?: SkillCompanies }) {
  if (!companies) return null;
  const { weakAt, strongAt } = companies;
  if (weakAt.length === 0 && strongAt.length === 0) return null;

  const cap = (arr: string[]) => {
    if (arr.length <= 3) return arr.join(", ");
    return `${arr.slice(0, 3).join(", ")} +${arr.length - 3}`;
  };

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {weakAt.length > 0 && (
        <span>
          Struggled at <span className="font-medium text-danger">{cap(weakAt)}</span>
        </span>
      )}
      {weakAt.length > 0 && strongAt.length > 0 && <span> · </span>}
      {strongAt.length > 0 && (
        <span>
          Strong at <span className="font-medium text-success">{cap(strongAt)}</span>
        </span>
      )}
    </p>
  );
}
