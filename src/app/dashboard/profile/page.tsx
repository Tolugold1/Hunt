import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import ResumeUpload from "./ResumeUpload";

export default async function ProfilePage() {
  const session = await auth();
  const userId = session!.user!.id!;

  const profile = await db.profile.findUnique({ where: { userId } });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile & Resume</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Your resume powers every cover letter Hunt generates.
        </p>
      </div>

      {/* Resume upload */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Resume</h2>
          {profile?.resumeUrl && (
            <span className="text-xs text-green-400 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Resume on file
            </span>
          )}
        </div>
        <ResumeUpload hasResume={!!profile?.resumeUrl} />
      </div>

      {/* Parsed profile — only shown if data exists */}
      {profile ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
          <h2 className="font-semibold text-white">Parsed Profile</h2>

          {/* Identity */}
          <div className="space-y-1">
            {profile.fullName && (
              <div className="text-lg font-semibold text-white">{profile.fullName}</div>
            )}
            {profile.headline && (
              <div className="text-gray-400 text-sm">{profile.headline}</div>
            )}
            {profile.location && (
              <div className="text-gray-500 text-sm flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
                {profile.location}
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">
                {profile.experienceYears ?? "—"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Years exp.</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">
                {profile.skills.length}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Skills found</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">
                {profile.remoteOk ? "Yes" : "No"}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Remote OK</div>
            </div>
          </div>

          {/* Skills */}
          {profile.skills.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Skills</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.skills.map((skill) => (
                  <span
                    key={skill}
                    className="text-xs px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-full"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job titles */}
          {profile.jobTitles.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Job titles</div>
              <div className="flex flex-wrap gap-1.5">
                {profile.jobTitles.map((title) => (
                  <span
                    key={title}
                    className="text-xs px-2.5 py-1 bg-gray-800 border border-gray-700 text-gray-300 rounded-full"
                  >
                    {title}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {profile.summary && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Summary</div>
              <p className="text-gray-400 text-sm leading-relaxed">{profile.summary}</p>
            </div>
          )}

          {/* Salary prefs */}
          {(profile.salaryMin || profile.salaryMax) && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Salary expectation</div>
              <div className="text-gray-300 text-sm">
                {profile.salaryCurrency ?? "USD"}{" "}
                {profile.salaryMin ? profile.salaryMin.toLocaleString() : "—"}
                {profile.salaryMax ? ` – ${profile.salaryMax.toLocaleString()}` : "+"}
                /yr
              </div>
            </div>
          )}

          <p className="text-xs text-gray-600 pt-2 border-t border-gray-800">
            Upload a new resume above to update this profile.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <div className="text-3xl mb-3">🗂️</div>
          <div className="text-gray-400 text-sm">
            No profile yet — upload your resume above to get started.
          </div>
        </div>
      )}

      {/* Mailbox */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-2">Connected mailbox</h2>
        <p className="text-gray-400 text-sm">
          Your Gmail account is connected via Google sign-in. Applications will be sent from that address.
          To change it, sign in with a different Google account.
        </p>
      </div>
    </div>
  );
}
