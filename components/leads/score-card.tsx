import { BandBadge } from "@/components/leads/band-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STAGE_LABELS } from "@/lib/constants";
import { BAND_BY_VALUE, SCORE_CRITERIA, SCORE_MAX, STAGE_POINTS, bandFor, leadScore } from "@/lib/scoring";
import type { Lead } from "@/types/lead";

/** The account's score out of 40, how it adds up, and the band's playbook. */
export function ScoreCard({ lead }: { lead: Lead }) {
  const score = leadScore(lead);
  const band = BAND_BY_VALUE[bandFor(score)];
  const parts = [
    { label: `Stage (${STAGE_LABELS[lead.stage]})`, value: STAGE_POINTS[lead.stage], max: 15 },
    ...SCORE_CRITERIA.map((c) => ({ label: c.label, value: lead[c.key], max: c.max })),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          <span>
            Score <span className="tabular-nums">{score}</span>
            <span className="text-sm font-normal text-muted-foreground">/{SCORE_MAX}</span>
          </span>
          <BandBadge band={band.value} />
        </CardTitle>
        <CardDescription>
          {band.status}. {band.playbook}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-2 text-sm">
          {parts.map((p) => (
            <div key={p.label} className="flex items-center gap-3">
              <dt className="min-w-0 flex-1 truncate text-muted-foreground">{p.label}</dt>
              <dd className="w-20 shrink-0">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(p.value / p.max) * 100}%` }} />
                </div>
              </dd>
              <dd className="w-12 shrink-0 text-right tabular-nums">
                {p.value}/{p.max}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
