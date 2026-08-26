export function createFieldManual() {
  const pages = []
  const ids = new Set()

  return {
    get pages() {
      return pages
    },

    addPage(debriefData, id) {
      // Use id if provided, else use actualCommand as dedup key
      const key = id || debriefData.actualCommand
      if (ids.has(key)) return false

      ids.add(key)
      pages.push(debriefData)
      return true
    },

    exportMarkdown() {
      let md = '# Field Manual - Runbook\n\n'

      pages.forEach((page, index) => {
        md += `## ${index + 1}. ${page.realWorldName}\n\n`
        md += `### What you did\n${page.whatYouDid}\n\n`
        md += `### The Command\n\`\`\`\n${page.actualCommand}\n\`\`\`\n\n`
        md += `### When to use it\n${page.whenToUse}\n\n`
        md += `### If you get it wrong\n${page.ifWrong}\n\n---\n\n`
      })

      return md.trim()
    }
  }
}
