---
description: Crea un git worktree en .worktrees/ con nombre derivado del contexto.
---

Crea un git worktree a partir del argumento del usuario.

Argumento: $ARGUMENTS

Instrucciones:
1. Analiza el argumento (puede contener espacios) y deduce un nombre conciso
   en kebab-case (minúsculas, palabras unidas con guiones, 3-5 palabras) que
   represente el contexto. Ejemplos:
   - "arreglar el bug de la nave" → arreglar-bug-nave
   - "add power ups"              → add-power-ups
   - "refactor collision"         → refactor-collision
2. Ejecuta, con la herramienta bash, ÚNICAMENTE este comando:
   git worktree add .worktrees/<nombre>
   donde <nombre> es el nombre kebab-case deducido.
3. No hagas nada más. No te cambies de directorio (no uses cd). No agregues,
   commitees ni modifiques archivos. Solo ejecuta el comando de creación
   del worktree.

Si el argumento está vacío, pregunta al usuario qué nombre/contexto usar
antes de ejecutar nada.
