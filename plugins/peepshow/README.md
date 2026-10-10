# peepshow (agent plugin)

Installs a generic `peepshow` skill into agents using the `.agents` marketplace interface. Behaviour mirrors `AGENTS.md` at the repo root — when the user shares a video or animated-image path, run `peepshow "<path>" --emit json`, parse `frames[]`, read each image.

Install via the repo-root marketplace:

```
<agent-cli> plugin marketplace add <owner>/peepshow
<agent-cli> plugin install peepshow@peepshow-repo
```
