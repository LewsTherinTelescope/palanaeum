$('#snippet-import-input').on('change', handle_snippet_import);

async function handle_snippet_import(event) {
    let snippets;
    try {
        if (this.files.length === 0) {
            throw 'No file selected to import!';
        }
        if (this.files.length > 1) {
            throw 'Only one file can be imported at a time!';
        }

        const file = this.files[0];
        const confirmation = confirm(`Are you sure you want to import '${file.name}'?`);
        if (!confirmation) {
            noty({ text: 'Snippet import cancelled.', type: 'information' });
            return;
        }
        noty({ text: 'Snippets importing. (This might take a minute!)', type: 'information' });

        const text = await file.text();
        const csv = parse_csv_from_string(text);
        snippets = parse_snippets_from_table(csv);
    } catch (err) {
        alert(err);
        noty({ text: 'Could not import snippets.', type: 'error' });
        return;
    }

    const player = AudioPlayer.get_instance();
    const source_id = player.get_source_id();

    window.unsaved_changes = true;
    $('.save').show();

    for (const snippet of snippets) {
        snippet.db_id = await get_next_snippet_id(source_id);
        player.append_snippet(snippet);
    };
    player.draw_snippets();
    noty({ text: 'Snippets imported!', type: 'success' });
}

function parse_csv_from_string(string) {
    const data = string.split(/\r?\n/)
        .filter(row => row.length > 0)
        .map(row => row.split(','));
    const headers = data.shift();
    return { headers, data };
}

const csv_expected_snippet_headers = [
    'Starting hour',
    'Starting minute',
    'Starting second',
    'Snippet name',
    'Optional?',
    'Ending hour',
    'Ending minute',
    'Ending second',
];
function parse_snippets_from_table(table) {
    // deliberately not validating exact header names or failing on extra columns to be flexible with users,
    // but having suggested names here is a good reminder of what each is for
    if (table.headers.length < csv_expected_snippet_headers.length) {
        throw `
            Cannot import snippets!
            
            Spreadsheet should have the following ${csv_expected_snippet_headers.length} columns:
            ${csv_expected_snippet_headers.map((header, i) => `${i + 1}. ${header}`).join('\n')}
            
            But instead it only has the following ${table.headers.length} columns:
            ${table.headers.map((header, i) => `${i + 1}. ${header}`).join('\n')}
        `.trim().replaceAll(/^[ \t]+/mg, '');
    }

    const snippets = table.data.map(parse_snippet_from_table_row);
    return snippets;
}

const csv_truthy_strings = ['1', 'true', 'yes', 'y'];
function parse_snippet_from_table_row(row) {
    const start_hours = Number(row[0]);
    const start_minutes = Number(row[1]);
    const start_seconds = Number(row[2]);
    const start_time = (start_hours * 60 * 60) + (start_minutes * 60) + start_seconds;

    const comment = row[3];
    const optional = csv_truthy_strings.includes(row[4].toLowerCase());

    const end_hours = Number(row[5]);
    const end_minutes = Number(row[6]);
    const end_seconds = Number(row[7]);
    const end_time = (end_hours * 60 * 60) + (end_minutes * 60) + end_seconds;

    const snippet = Object.assign(new Snippet(), {
        start_time,
        end_time,
        comment,
        optional,
    });

    return snippet;
}

async function get_next_snippet_id(source_id) {
    const ret = await $.post(Palanaeum.SNIPPET_CREATE_URL, { source_id });
    if (ret['success']) {
        return ret['snippet_id'];
    } else {
        throw ret['reason'];
    }
}
