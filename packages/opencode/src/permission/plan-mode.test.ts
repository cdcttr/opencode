import { describe, test, expect } from "bun:test"
import { validateCommandForPlanMode, isPlanMode, isPlanPath } from "./plan-mode"

describe("PlanMode", () => {
  describe("isPlanMode", () => {
    test("returns true for plan agent", () => {
      expect(isPlanMode("plan")).toBe(true)
    })

    test("returns false for build agent", () => {
      expect(isPlanMode("build")).toBe(false)
    })

    test("returns false for other agents", () => {
      expect(isPlanMode("general")).toBe(false)
      expect(isPlanMode("explore")).toBe(false)
    })
  })

  describe("isPlanPath", () => {
    test("returns true for .opencode/plans path", () => {
      expect(isPlanPath(".opencode/plans/my-plan.md")).toBe(true)
    })

    test("returns true for nested .opencode/plans path", () => {
      expect(isPlanPath(".opencode/plans/subdir/file.md")).toBe(true)
    })

    test("returns true for deeply nested path", () => {
      expect(isPlanPath(".opencode/plans/new_feature/research.md")).toBe(true)
    })

    test("returns true for research files in subdirs", () => {
      expect(isPlanPath(".opencode/plans/new_feature/research.notes")).toBe(true)
    })

    test("returns true for absolute path with plans", () => {
      expect(isPlanPath("/home/user/project/.opencode/plans/plan.md")).toBe(true)
    })

    test("returns true for just the plans directory", () => {
      expect(isPlanPath(".opencode/plans")).toBe(true)
    })

    test("returns false for non-plan paths", () => {
      expect(isPlanPath("src/index.ts")).toBe(false)
    })

    test("returns false for random directory", () => {
      expect(isPlanPath("mydir")).toBe(false)
    })

    test("returns false for plans in wrong location", () => {
      expect(isPlanPath("src/plans/file.md")).toBe(false)
    })

    test("returns false for random plans directory", () => {
      expect(isPlanPath("/tmp/plans/file.md")).toBe(false)
    })
  })

  describe("validateCommandForPlanMode", () => {
    describe("non-plan mode", () => {
      test("allows all commands in build mode", () => {
        expect(validateCommandForPlanMode("rm -rf /", "build").action).toBe("allow")
        expect(validateCommandForPlanMode("git commit -m 'test'", "build").action).toBe("allow")
      })
    })

    describe("destructive commands (deny)", () => {
      test("blocks rm command", () => {
        const result = validateCommandForPlanMode("rm file.txt", "plan")
        expect(result.action).toBe("deny")
        expect(result.command).toBe("rm")
      })

      test("blocks rm -rf", () => {
        const result = validateCommandForPlanMode("rm -rf /", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks sed command", () => {
        const result = validateCommandForPlanMode("sed -i 's/old/new/g' file.txt", "plan")
        expect(result.action).toBe("deny")
        expect(result.command).toBe("sed")
      })

      test("blocks mv command", () => {
        const result = validateCommandForPlanMode("mv old.txt new.txt", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks chmod command", () => {
        const result = validateCommandForPlanMode("chmod +x script.sh", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks tee command", () => {
        const result = validateCommandForPlanMode("tee file.txt", "plan")
        expect(result.action).toBe("deny")
      })
    })

    describe("package manager commands (deny)", () => {
      test("blocks npm install", () => {
        const result = validateCommandForPlanMode("npm install", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks npm i shorthand", () => {
        const result = validateCommandForPlanMode("npm i lodash", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks yarn add", () => {
        const result = validateCommandForPlanMode("yarn add react", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks pip install", () => {
        const result = validateCommandForPlanMode("pip install requests", "plan")
        expect(result.action).toBe("deny")
      })
    })

    describe("git commands", () => {
      test("blocks git commit", () => {
        const result = validateCommandForPlanMode("git commit -m 'test'", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks git push", () => {
        const result = validateCommandForPlanMode("git push origin main", "plan")
        expect(result.action).toBe("deny")
      })

      test("allows git status", () => {
        const result = validateCommandForPlanMode("git status", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows git diff", () => {
        const result = validateCommandForPlanMode("git diff", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows git log", () => {
        const result = validateCommandForPlanMode("git log --oneline", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows git branch", () => {
        const result = validateCommandForPlanMode("git branch -a", "plan")
        expect(result.action).toBe("allow")
      })
    })

    describe("gh (GitHub CLI) commands", () => {
      test("allows gh issue list", () => {
        const result = validateCommandForPlanMode("gh issue list", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh issue view", () => {
        const result = validateCommandForPlanMode("gh issue view 123", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh pr list", () => {
        const result = validateCommandForPlanMode("gh pr list", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh pr view", () => {
        const result = validateCommandForPlanMode("gh pr view 456", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh pr checks", () => {
        const result = validateCommandForPlanMode("gh pr checks", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh run list", () => {
        const result = validateCommandForPlanMode("gh run list", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh run view", () => {
        const result = validateCommandForPlanMode("gh run view 789", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh release list", () => {
        const result = validateCommandForPlanMode("gh release list", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh repo view", () => {
        const result = validateCommandForPlanMode("gh repo view owner/repo", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows gh api GET requests", () => {
        const result = validateCommandForPlanMode("gh api repos/owner/repo/issues", "plan")
        expect(result.action).toBe("allow")
      })

      test("blocks gh issue create", () => {
        const result = validateCommandForPlanMode("gh issue create --title 'Test'", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh issue close", () => {
        const result = validateCommandForPlanMode("gh issue close 123", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh pr create", () => {
        const result = validateCommandForPlanMode("gh pr create --title 'Test'", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh pr merge", () => {
        const result = validateCommandForPlanMode("gh pr merge 456", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh pr review", () => {
        const result = validateCommandForPlanMode("gh pr review 456 --approve", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh pr comment", () => {
        const result = validateCommandForPlanMode("gh pr comment 456 --body 'test'", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh release create", () => {
        const result = validateCommandForPlanMode("gh release create v1.0", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh run cancel", () => {
        const result = validateCommandForPlanMode("gh run cancel 789", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh workflow run", () => {
        const result = validateCommandForPlanMode("gh workflow run build.yml", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks gh repo delete", () => {
        const result = validateCommandForPlanMode("gh repo delete owner/repo", "plan")
        expect(result.action).toBe("deny")
      })
    })

    describe("content creation commands", () => {
      test("allows mkdir for plan paths", () => {
        const result = validateCommandForPlanMode("mkdir .opencode/plans", "plan")
        expect(result.action).toBe("allow")
      })

      test("allows mkdir -p for plan paths", () => {
        const result = validateCommandForPlanMode("mkdir -p .opencode/plans/subdir", "plan")
        expect(result.action).toBe("allow")
      })

      test("denies mkdir for non-plan paths", () => {
        const result = validateCommandForPlanMode("mkdir newdir", "plan")
        expect(result.action).toBe("deny")
      })

      test("allows touch for plan paths", () => {
        const result = validateCommandForPlanMode("touch .opencode/plans/my-plan.md", "plan")
        expect(result.action).toBe("allow")
      })

      test("denies touch for non-plan paths", () => {
        const result = validateCommandForPlanMode("touch newfile.txt", "plan")
        expect(result.action).toBe("deny")
      })
    })

    describe("read-only commands (allow)", () => {
      test("allows ls", () => {
        expect(validateCommandForPlanMode("ls -la", "plan").action).toBe("allow")
      })

      test("allows cat", () => {
        expect(validateCommandForPlanMode("cat file.txt", "plan").action).toBe("allow")
      })

      test("allows grep", () => {
        expect(validateCommandForPlanMode("grep -r 'pattern' src/", "plan").action).toBe("allow")
      })

      test("allows find", () => {
        expect(validateCommandForPlanMode("find . -name '*.ts'", "plan").action).toBe("allow")
      })

      test("allows echo", () => {
        expect(validateCommandForPlanMode("echo 'hello world'", "plan").action).toBe("allow")
      })

      test("allows pwd", () => {
        expect(validateCommandForPlanMode("pwd", "plan").action).toBe("allow")
      })

      test("allows which", () => {
        expect(validateCommandForPlanMode("which node", "plan").action).toBe("allow")
      })
    })

    describe("dangerous characters (deny)", () => {
      test("blocks backtick command substitution", () => {
        const result = validateCommandForPlanMode("echo `date`", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks newline injection", () => {
        const result = validateCommandForPlanMode("echo hello\nrm -rf /", "plan")
        expect(result.action).toBe("deny")
      })

      test("blocks file redirect", () => {
        const result = validateCommandForPlanMode("echo hello > file.txt", "plan")
        expect(result.action).toBe("deny")
      })
    })

    describe("edge cases", () => {
      test("handles empty command", () => {
        expect(validateCommandForPlanMode("", "plan").action).toBe("allow")
      })

      test("handles whitespace-only command", () => {
        expect(validateCommandForPlanMode("   ", "plan").action).toBe("allow")
      })

      test("handles commands with leading whitespace", () => {
        const result = validateCommandForPlanMode("   rm file.txt", "plan")
        expect(result.action).toBe("deny")
      })

      test("is case-insensitive for commands", () => {
        const result = validateCommandForPlanMode("RM file.txt", "plan")
        expect(result.action).toBe("deny")
      })
    })
  })
})
