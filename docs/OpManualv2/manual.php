<?php
$jsonFile = 'manual.json';

// Load the current file
$manual = json_decode(file_get_contents($jsonFile), true);

// Wrap root for traversal
$wrapper = ['subsections' => [$manual]];

$EditMode = isset($_GET['edit']) && $_GET['edit'] === '1';


// Handle edits/adds
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $path = explode('/', $_POST['path']);
    $target = &$wrapper;
    foreach ($path as $index) {
        if (!isset($target['subsections'])) {
            $target['subsections'] = [];
        }
        $target = &$target['subsections'][(int)$index];
    }

    if (isset($_POST['edit'])) {
        $target['content'] = $_POST['content'];
        $target['title'] = $_POST['title'];
        $target['tags'] = array_map('trim', explode(',', $_POST['tags']));
        $target['lastEdited'] = date('Y.m.d');
    } elseif (isset($_POST['add'])) {
        $new = [
            "title" => $_POST['new_title'],
            "tags" => array_map('trim', explode(',', $_POST['new_tags'])),
            "content" => $_POST['new_content'],
            "lastEdited" => date('Y.m.d'),
            "subsections" => []
        ];
        $target['subsections'][] = $new;
    } elseif (isset($_POST['reorder'])) {
        $path = trim($_POST['path']);
        $direction = $_POST['direction'];
        $indices = explode('/', $path);
        $last = array_pop($indices);
        $parent = &$wrapper;
        foreach ($indices as $index) {
            if (!isset($parent['subsections'])) $parent['subsections'] = [];
            $parent = &$parent['subsections'][(int)$index];
        }
        $i = (int)$last;
        $swapWith = ($direction === 'up') ? $i - 1 : $i + 1;
        if (isset($parent['subsections'][$i]) && isset($parent['subsections'][$swapWith])) {
            $temp = $parent['subsections'][$i];
            $parent['subsections'][$i] = $parent['subsections'][$swapWith];
            $parent['subsections'][$swapWith] = $temp;
        }
    } elseif (isset($_POST['reorderLateral'])) {
        $path = trim($_POST['path']);
        $direction = $_POST['direction'];
        $indices = explode('/', $path);
        $lastIndex = (int)array_pop($indices);
        $parentPath = $indices;
        $grandparent = &$wrapper;
        foreach ($parentPath as $index) {
            $grandparent = &$grandparent['subsections'][(int)$index];
        }
        if (!isset($grandparent['subsections'])) return;
        if ($direction === 'left' && count($parentPath) > 1) {
            $moving = $grandparent['subsections'][$lastIndex];
            unset($grandparent['subsections'][$lastIndex]);
            $grandparent['subsections'] = array_values($grandparent['subsections']);
            array_pop($parentPath);
            $newParent = &$wrapper;
            foreach ($parentPath as $index) {
                $newParent = &$newParent['subsections'][(int)$index];
            }
            $currentParentIndex = (int)end($indices);
            array_splice($newParent['subsections'], $currentParentIndex + 1, 0, [$moving]);
        } elseif ($direction === 'right' && $lastIndex > 0) {
            $prevSibling = &$grandparent['subsections'][$lastIndex - 1];
            if (!isset($prevSibling['subsections'])) {
                $prevSibling['subsections'] = [];
            }
            $moving = $grandparent['subsections'][$lastIndex];
            unset($grandparent['subsections'][$lastIndex]);
            $grandparent['subsections'] = array_values($grandparent['subsections']);
            $prevSibling['subsections'][] = $moving;
        }
    }
    file_put_contents($jsonFile, json_encode($wrapper['subsections'][0], JSON_PRETTY_PRINT));
    $manual = json_decode(file_get_contents($jsonFile), true);
    $wrapper = ['subsections' => [$manual]];
    header("Location: " . $_SERVER['PHP_SELF']);
    exit();
}

function render_section($section, $path = '0', $depth = 0, $EditMode = true) {
    $renderDepth = min($depth, 5);
    $headingLevel = $renderDepth + 1;
    $tag = "h$headingLevel";
    $id = str_replace('/', '_', $path);
    $editId = "edit_$id";
    $addId = "add_$id";
    $nextHeading = min($headingLevel + 1, 6);

    echo "<div class='section' data-depth='$depth'>";
    
    // HEADER
    echo "<div class='section-header' onclick=\"toggleContent('$id')\">";
    echo "<$tag class='section-title'>" . htmlspecialchars($section['title']) . "</$tag>";
    echo "</div>";

    // ACTION BUTTONS
    if ($EditMode) {
        echo "<div class='section-actions'>";
        echo "<button type='button' onclick=\"toggleEdit('$id')\">Edit Section</button>";

        // Reorder: ↑ ↓
        echo "<form method='POST' style='display:inline;'><input type='hidden' name='path' value='$path'><input type='hidden' name='reorder' value='1'><input type='hidden' name='direction' value='up'><button type='submit'>↑</button></form>";
        echo "<form method='POST' style='display:inline;'><input type='hidden' name='path' value='$path'><input type='hidden' name='reorder' value='1'><input type='hidden' name='direction' value='down'><button type='submit'>↓</button></form>";

        // Reorder lateral: ← →
        if ($headingLevel > 2) {
            echo "<form method='POST' style='display:inline;'><input type='hidden' name='path' value='$path'><input type='hidden' name='reorderLateral' value='1'><input type='hidden' name='direction' value='left'><button type='submit'>←</button></form>";
        }

        if ($headingLevel < 6) {
            echo "<form method='POST' style='display:inline;'><input type='hidden' name='path' value='$path'><input type='hidden' name='reorderLateral' value='1'><input type='hidden' name='direction' value='right'><button type='submit'>→</button></form>";
        }

        // Add subsection
        if ($headingLevel < 6) {
            echo "<button type='button' onclick=\"toggleVisibility('$addId')\">Add New H$nextHeading</button>";
        }

        echo "</div>"; // .section-actions
    }

    // CONTENT
    echo "<div id='content_$id' class='section-content' style='display:none;'>";
    if (!empty($section['tags']) && $EditMode) {
        echo "<div class='tagline'>Tags: " . implode(', ', array_map('htmlspecialchars', $section['tags'])) . "</div>";
    }
    $paragraphs = preg_split('/\r\n|\r|\n/', $section['content']);
    foreach ($paragraphs as $para) {
        $trimmed = trim($para);
        if ($trimmed !== '') {
            echo "<p>" . htmlspecialchars($trimmed) . "</p>";
        }
    }
    
    // ⬇️ Children will now be nested *inside* the section-content:
    foreach ($section['subsections'] as $i => $sub) {
        render_section($sub, "$path/$i", $depth + 1, $EditMode);
    }

    // EDIT MODE FORM
    echo "<div id='$editId' class='edit-form' style='display:none;'>";
    echo "<div class='edit-close'><button type='button' onclick=\"toggleEdit('$id')\">✖</button></div>";
    echo "<form method='POST'>";
    echo "Title: <input name='title' value=\"" . htmlspecialchars($section['title']) . "\" required><br>";
    echo "Tags: <input name='tags' value=\"" . htmlspecialchars(implode(',', $section['tags'])) . "\"><br>";
    echo <<<TOOLBAR
    <div class="format-toolbar">
        <button type="button" onclick="insertTag('$editId', '<strong>', '</strong>')"><b>B</b></button>
        <button type="button" onclick="insertTag('$editId', '<em>', '</em>')"><i>I</i></button>
        <button type="button" onclick="insertTag('$editId', '<ul><li>', '</li></ul>')">List</button>
        <button type="button" onclick="insertTag('$editId', '<p style=&quot;margin-left:2em;&quot;>', '</p>')">Indent</button>
    </div>
    TOOLBAR;
    echo "Content:<br><textarea name='content' rows='4' cols='80'>" . htmlspecialchars($section['content']) . "</textarea><br>";
    echo "<input type='hidden' name='path' value='$path'>";
    echo "<input type='hidden' name='edit' value='1'>";
    echo "<button type='submit'>Save</button>";
    echo "</form></div>";

    // ADD FORM
    if ($EditMode && $headingLevel < 6) {
        echo "<div id='$addId' class='add-form' style='display:none;'>";
        echo "<form method='POST'>";
        echo "Title: <input name='new_title' required><br>";
        echo "Tags: <input name='new_tags'><br>";
        echo "Content:<br><textarea name='new_content' rows='4' cols='80'></textarea><br>";
        echo "<input type='hidden' name='path' value='$path'>";
        echo "<input type='hidden' name='add' value='1'>";
        echo "<button type='submit'>Add Section</button>";
        echo "</form></div>";
    }

    echo "</div>"; // .section-content
    echo "</div>"; // .section
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>Operations Manual</title>
    <link rel="stylesheet" href="styles.css">
    <script>
        let globalEditMode = true;
        function toggleGlobalEditMode() {
            globalEditMode = !globalEditMode;

            document.querySelectorAll('.section-actions, .edit-form, .add-form').forEach(el => {
                el.style.display = globalEditMode ? 'block' : 'none';
            });

            document.getElementById('editToggleBtn').innerText = globalEditMode ? 'Exit Edit Mode' : 'Enter Edit Mode';
        }

        function toggleEdit(id) {
            const content = document.getElementById('content_' + id);
            const edit = document.getElementById('edit_' + id);
            if (content && edit) {
                const isEditing = edit.style.display === 'block';
                content.style.display = isEditing ? 'block' : 'none';
                edit.style.display = isEditing ? 'none' : 'block';
            }
        }

        function toggleVisibility(id) {
            const el = document.getElementById(id);
            if (el) el.style.display = (el.style.display === 'none') ? 'block' : 'none';
        }

        function toggleContent(id) {
            const content = document.getElementById('content_' + id);
            if (!content) return;

            const isExpanding = content.style.display === 'none';
            content.style.display = isExpanding ? 'block' : 'none';

            // Also toggle any nested .section-content blocks
            content.querySelectorAll('').forEach(el => {
                el.style.display = isExpanding ? 'block' : 'none';
            });
        }
        function insertTag(sectionId, openTag, closeTag) {
            const textarea = document.querySelector(`#edit_${sectionId} textarea`);
            if (!textarea) return;

            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = textarea.value.substring(start, end);
            const newText = textarea.value.substring(0, start) + openTag + selected + closeTag + textarea.value.substring(end);

            textarea.value = newText;

            // Re-focus and move cursor
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = start + openTag.length + selected.length + closeTag.length;
        }
        </script>
</head>
<body>
    <div style="text-align:center; margin: 1rem;">
        <?php if ($EditMode): ?>
            <a href="?edit=0"><button>Exit Edit Mode</button></a>
        <?php else: ?>
            <a href="?edit=1"><button>Enter Edit Mode</button></a>
        <?php endif; ?>
    </div>
    <div class="content">
        <div class="manual-header">
            <h1><?php echo htmlspecialchars($wrapper['subsections'][0]['title']); ?></h1>
            <p><?php echo nl2br(htmlspecialchars($wrapper['subsections'][0]['content'])); ?></p>
        </div>
        <?php
            foreach ($wrapper['subsections'][0]['subsections'] as $i => $sub) {
                render_section($sub, "0/$i", 1, $EditMode);
            }
        ?>
    </div>
</body>
</html>