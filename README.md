# Bot sanction Discord

Bot Discord.js v14 avec commandes slash, niveaux `PERM1` à `PERM9`, historique JSON et composants (boutons de pagination et confirmation).

## Installation

```bash
npm install
```

Configure directement le fichier `.env` avec au minimum `DISCORD_TOKEN`, `CLIENT_ID` et `OWNER_ID`. `GUILD_ID` permet de déployer les commandes immédiatement dans un serveur de test. Les rôles PERM se configurent maintenant depuis `/panel` et sont sauvegardés dans `sanctions.json`.

Niveaux par défaut : `PERM1` pour les listes et `baninfo`, `PERM2` pour `tempmute`/`unmute`, `PERM4` pour `ban`/`unban`, et `PERM6` pour `delsanction`. Les administrateurs et `OWNER_ID` ont le niveau 9.

`PERM9` peut modifier ces niveaux avec `/set perm commande niveau`, par exemple `/set perm tempmute perm2`. Le niveau choisi et tous les niveaux supérieurs peuvent alors utiliser la commande.

Pour remettre une commande à son niveau par défaut : `/del perm commande`, par exemple `/del perm tempmute`.
`/del perm commande` désactive la commande avec le niveau `0`. Personne ne peut alors l'utiliser, et un sys peut la réactiver avec `/set perm commande niveau`. Exemple : `/del perm tempmute`.

`/perms` affiche les rôles associés à `PERM1` jusqu’à `PERM9`. Pour consulter un seul niveau : `/perms niveau:PERM2`.

`/helpall` ouvre un menu déroulant gris permettant de voir les commandes de chaque niveau `PERM1` à `PERM9`.

`/autolog configurer serveur_id:ID` relie le serveur où la commande est lancée (serveur officiel) au serveur dédié aux logs. Le bot doit être présent sur les deux serveurs avec la permission de gérer les salons. Ensuite `/autolog activer` crée automatiquement la catégorie `📁・sanctions` et les salons `📁・ban`, `📁・unban`, `📁・tempmute`, `📁・unmute`, `📁・sanctions` et `📁・systeme` dans le serveur de logs. Les sanctions effectuées sur le serveur officiel sont envoyées dans le serveur de logs. `/autolog desactiver` arrête les logs sans supprimer les salons.

`/panel` est accessible uniquement à `OWNER_ID` et aux sys du bot. Les sys peuvent utiliser toutes les commandes du bot et modifier les rôles PERM ainsi que les niveaux minimum des commandes. Le propriétaire ajoute ou retire un sys avec `/sys add utilisateur` et `/sys del utilisateur`. `/sys list` affiche les sys autorisés. Seul le propriétaire peut gérer la liste des sys.

## Lancement

```bash
npm start
```

Le bot doit avoir les permissions `Moderate Members`, `Ban Members`, `Send Messages` et `Embed Links`. Les mutes sont limités à 28 jours par Discord. `delsanction` retire uniquement l'entrée de l'historique, pas une sanction déjà appliquée.

`/tempmute appliquer membre` ouvre les presets de mute dans un menu Components V2. `/tempmute modif` permet de créer ou modifier les presets directement sur Discord (par exemple `Insulte` pendant `20m`).