import { readFile, writeFile, mkdir } from 'node:fs/promises';
const chinese = JSON.parse(await readFile('translations.json', 'utf8'));
// Authored starter translations. Missing entries intentionally retain source text.
// Columns: source, Spanish, French, German, Brazilian Portuguese, Japanese.
const rows = [
  ['Change Window Params', 'Parámetros de ventana', 'Paramètres de fenêtre', 'Fensterparameter', 'Parâmetros da janela', 'ウィンドウ設定'],
  ['Advanced Mode', 'Modo avanzado', 'Mode avancé', 'Erweiterter Modus', 'Modo avançado', '詳細モード'],
  ['Enable advanced mode', 'Activar modo avanzado', 'Activer le mode avancé', 'Erweiterten Modus aktivieren', 'Ativar modo avançado', '詳細モードを有効にする'],
  ['Open window', 'Abrir ventana', 'Ouvrir une fenêtre', 'Fenster öffnen', 'Abrir janela', 'ウィンドウを開く'],
  ['Reset settings', 'Restablecer ajustes', 'Réinitialiser les paramètres', 'Einstellungen zurücksetzen', 'Redefinir configurações', '設定をリセット'],
  ['Restart Steam UI', 'Reiniciar la interfaz de Steam', 'Redémarrer l’interface Steam', 'Steam-Oberfläche neu starten', 'Reiniciar a interface do Steam', 'Steam の画面を再起動'],
  ['Actions', 'Acciones', 'Actions', 'Aktionen', 'Ações', '操作'],
  ['Verified Settings', 'Ajustes verificados', 'Paramètres vérifiés', 'Geprüfte Einstellungen', 'Configurações verificadas', '検証済みの設定'],
  ['Use system titlebar', 'Usar barra de título del sistema', 'Utiliser la barre de titre système', 'Systemtitelleiste verwenden', 'Usar barra de título do sistema', 'システムのタイトルバーを使用'],
  ['Exclude menus', 'Excluir menús', 'Exclure les menus', 'Menüs ausschließen', 'Excluir menus', 'メニューを除外'],
  ['Exclude notifications', 'Excluir notificaciones', 'Exclure les notifications', 'Benachrichtigungen ausschließen', 'Excluir notificações', '通知を除外'],
  ['Transparent windows', 'Ventanas transparentes', 'Fenêtres transparentes', 'Transparente Fenster', 'Janelas transparentes', '透明なウィンドウ'],
  ['No window size limit', 'Sin límite de tamaño de ventana', 'Sans limite de taille de fenêtre', 'Keine Fenstergrößenbegrenzung', 'Sem limite de tamanho da janela', 'ウィンドウサイズの制限なし'],
  ['Window type', 'Tipo de ventana', 'Type de fenêtre', 'Fenstertyp', 'Tipo de janela', 'ウィンドウの種類'],
  ['Minimum window height', 'Altura mínima de ventana', 'Hauteur minimale de fenêtre', 'Minimale Fensterhöhe', 'Altura mínima da janela', 'ウィンドウの最小高さ'],
  ['Minimum window width', 'Anchura mínima de ventana', 'Largeur minimale de fenêtre', 'Minimale Fensterbreite', 'Largura mínima da janela', 'ウィンドウの最小幅'],
  ['Achievement Groups', 'Grupos de logros', 'Groupes de succès', 'Errungenschaftsgruppen', 'Grupos de conquistas', '実績グループ'],
  ['Preferences', 'Preferencias', 'Préférences', 'Einstellungen', 'Preferências', '環境設定'],
  ['Preview', 'Vista previa', 'Aperçu', 'Vorschau', 'Prévia', 'プレビュー'],
  ['Preview Game', 'Vista previa del juego', 'Aperçu du jeu', 'Spielvorschau', 'Prévia do jogo', 'ゲームのプレビュー'],
  ['Preview Group', 'Vista previa del grupo', 'Aperçu du groupe', 'Gruppenvorschau', 'Prévia do grupo', 'グループのプレビュー'],
  ['Preview Achievement', 'Vista previa del logro', 'Aperçu du succès', 'Errungenschaftsvorschau', 'Prévia da conquista', '実績のプレビュー'],
  ['Show points', 'Mostrar puntos', 'Afficher les points', 'Punkte anzeigen', 'Mostrar pontos', 'ポイントを表示'],
  ['Show Unlocked', 'Mostrar desbloqueados', 'Afficher les succès débloqués', 'Freigeschaltete anzeigen', 'Mostrar desbloqueadas', '解除済みを表示'],
  ['Hide hidden achievements', 'Ocultar logros ocultos', 'Masquer les succès cachés', 'Versteckte Errungenschaften ausblenden', 'Ocultar conquistas ocultas', '隠し実績を非表示'],
  ['Proxy URL', 'URL del proxy', 'URL du proxy', 'Proxy-URL', 'URL do proxy', 'プロキシ URL'],
  ['Cache duration', 'Duración de la caché', 'Durée du cache', 'Cache-Dauer', 'Duração do cache', 'キャッシュ期間'],
  ['Clear Cache', 'Borrar caché', 'Vider le cache', 'Cache leeren', 'Limpar cache', 'キャッシュを消去'],
  ['Save Defaults', 'Guardar valores predeterminados', 'Enregistrer les valeurs par défaut', 'Standardwerte speichern', 'Salvar padrões', '既定値を保存'],
  ['Clear Defaults', 'Borrar valores predeterminados', 'Effacer les valeurs par défaut', 'Standardwerte löschen', 'Limpar padrões', '既定値を消去'],
  ['Expand All', 'Expandir todo', 'Tout développer', 'Alle aufklappen', 'Expandir tudo', 'すべて展開'],
  ['Collapse All', 'Contraer todo', 'Tout réduire', 'Alle zuklappen', 'Recolher tudo', 'すべて折りたたむ'],
  ['Expand', 'Expandir', 'Développer', 'Aufklappen', 'Expandir', '展開'],
  ['Collapse', 'Contraer', 'Réduire', 'Zuklappen', 'Recolher', '折りたたむ'],
  ['Search achievements...', 'Buscar logros...', 'Rechercher des succès...', 'Errungenschaften suchen...', 'Pesquisar conquistas...', '実績を検索...'],
  ['Name', 'Nombre', 'Nom', 'Name', 'Nome', '名前'],
  ['Date', 'Fecha', 'Date', 'Datum', 'Data', '日付'],
  ['Reverse', 'Invertir orden', 'Inverser l’ordre', 'Reihenfolge umkehren', 'Inverter ordem', '逆順'],
  ['Unlocked', 'Desbloqueado', 'Débloqué', 'Freigeschaltet', 'Desbloqueada', '解除済み'],
  ['Unachieved', 'No conseguido', 'Non obtenu', 'Nicht erreicht', 'Não alcançada', '未達成'],
  ['Achieved', 'Conseguido', 'Obtenu', 'Erreicht', 'Alcançada', '達成済み'],
  ['Hidden Achievement', 'Logro oculto', 'Succès caché', 'Versteckte Errungenschaft', 'Conquista oculta', '隠し実績'],
  ['Guide', 'Guía', 'Guide', 'Anleitung', 'Guia', 'ガイド'],
  ['Reveal', 'Mostrar', 'Révéler', 'Aufdecken', 'Revelar', '表示'],
  ['Browser History', 'Historial del navegador', 'Historique du navigateur', 'Browserverlauf', 'Histórico do navegador', 'ブラウザー履歴'],
  ['History', 'Historial', 'Historique', 'Verlauf', 'Histórico', '履歴'],
  ['Extensions', 'Extensiones', 'Extensions', 'Erweiterungen', 'Extensões', '拡張機能'],
  ['Manage extensions', 'Gestionar extensiones', 'Gérer les extensions', 'Erweiterungen verwalten', 'Gerenciar extensões', '拡張機能を管理'],
  ['Extension', 'Extensión', 'Extension', 'Erweiterung', 'Extensão', '拡張機能'],
  ['Description', 'Descripción', 'Description', 'Beschreibung', 'Descrição', '説明'],
  ['Version', 'Versión', 'Version', 'Version', 'Versão', 'バージョン'],
  ['Details', 'Detalles', 'Détails', 'Details', 'Detalhes', '詳細'],
  ['Options', 'Opciones', 'Options', 'Optionen', 'Opções', 'オプション'],
  ['Manage', 'Gestionar', 'Gérer', 'Verwalten', 'Gerenciar', '管理'],
  ['Install extension', 'Instalar extensión', 'Installer l’extension', 'Erweiterung installieren', 'Instalar extensão', '拡張機能をインストール'],
  ['Remove extension', 'Eliminar extensión', 'Supprimer l’extension', 'Erweiterung entfernen', 'Remover extensão', '拡張機能を削除'],
  ['Uninstall extension', 'Desinstalar extensión', 'Désinstaller l’extension', 'Erweiterung deinstallieren', 'Desinstalar extensão', '拡張機能をアンインストール'],
  ['Extension options', 'Opciones de la extensión', 'Options de l’extension', 'Erweiterungsoptionen', 'Opções da extensão', '拡張機能のオプション'],
  ['Add link', 'Añadir enlace', 'Ajouter un lien', 'Link hinzufügen', 'Adicionar link', 'リンクを追加'],
  ['External links', 'Enlaces externos', 'Liens externes', 'Externe Links', 'Links externos', '外部リンク'],
  ['No links yet.', 'Aún no hay enlaces.', 'Aucun lien pour le moment.', 'Noch keine Links.', 'Nenhum link ainda.', 'リンクはまだありません。'],
  ['Remove', 'Eliminar', 'Supprimer', 'Entfernen', 'Remover', '削除'],
  ['Pin', 'Fijar', 'Épingler', 'Anheften', 'Fixar', '固定'],
  ['Unpin', 'Desfijar', 'Désépingler', 'Lösen', 'Desafixar', '固定を解除'],
  ['Inspect views', 'Inspeccionar vistas', 'Inspecter les vues', 'Ansichten untersuchen', 'Inspecionar visualizações', 'ビューを検証'],
  ['Browser', 'Navegador', 'Navigateur', 'Browser', 'Navegador', 'ブラウザー'],
  ['Console', 'Consola', 'Console', 'Konsole', 'Console', 'コンソール'],
  ['Delete All', 'Eliminar todo', 'Tout supprimer', 'Alle löschen', 'Excluir tudo', 'すべて削除'],
  ['Unknown error', 'Error desconocido', 'Erreur inconnue', 'Unbekannter Fehler', 'Erro desconhecido', '不明なエラー'],
  ['Perfect', 'Perfecto', 'Parfait', 'Perfekt', 'Perfeito', '完全対応'],
  ['Great', 'Muy bien', 'Très bien', 'Sehr gut', 'Ótimo', '良好'],
  ['Okay', 'Aceptable', 'Acceptable', 'Akzeptabel', 'Aceitável', '許容範囲'],
  ['Broken', 'No funciona', 'Défectueux', 'Defekt', 'Com falhas', '動作しない'],
  ['Non-Steam Playtimes', 'Tiempo de juego externo a Steam', 'Temps de jeu hors Steam', 'Spielzeiten für Nicht-Steam-Spiele', 'Tempo de jogo fora do Steam', '非 Steam ゲームのプレイ時間'],
  ['Play Time', 'Tiempo de juego', 'Temps de jeu', 'Spielzeit', 'Tempo de jogo', 'プレイ時間'],
  ['Playtime', 'Tiempo de juego', 'Temps de jeu', 'Spielzeit', 'Tempo de jogo', 'プレイ時間'],
  ['Save', 'Guardar', 'Enregistrer', 'Speichern', 'Salvar', '保存'],
  ['Saved', 'Guardado', 'Enregistré', 'Gespeichert', 'Salvo', '保存済み'],
  ['Failed', 'Error', 'Échec', 'Fehlgeschlagen', 'Falhou', '失敗'],
  ['Unknown', 'Desconocido', 'Inconnu', 'Unbekannt', 'Desconhecido', '不明']
];
const languages = [
  { id: 'en', name: 'English', full: true },
  { id: 'zh-CN', name: '简体中文', full: true },
  { id: 'es', name: 'Español' }, { id: 'fr', name: 'Français' },
  { id: 'de', name: 'Deutsch' }, { id: 'pt-BR', name: 'Português (Brasil)' },
  { id: 'ja', name: '日本語' }
];
await mkdir('locales', { recursive: true });
const packs = { en: Object.fromEntries(Object.keys(chinese).map(key => [key, key])), 'zh-CN': chinese };
for (let i = 0; i < 5; i++) packs[languages[i + 2].id] = Object.fromEntries(rows.map(row => [row[0], row[i + 1]]));
for (const language of languages) {
  language.path = `locales/${language.id}.json`;
  language.entries = Object.keys(packs[language.id]).length;
  language.status = language.full ? 'complete-for-bundled-source' : 'starter';
  await writeFile(language.path, JSON.stringify(packs[language.id], null, 2) + '\n');
}
await writeFile('locales/catalog.json', JSON.stringify({ version: 1, sourceLanguage: 'en', languages }, null, 2) + '\n');
