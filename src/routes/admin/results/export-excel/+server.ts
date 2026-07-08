import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireSuperAdmin } from '$lib/server/guards';
import { supabaseAdmin } from '$lib/server/supabase';
import ExcelJS from 'exceljs';
import { fetchRankings } from '$lib/results/query';

export const GET: RequestHandler = async ({ url, locals }) => {
	await requireSuperAdmin(locals.user);

	// Parse categories from query string if available
	const categoriesParam = url.searchParams.get('category');
	const categories = categoriesParam ? categoriesParam.split(',') : ['A', 'B', 'C'];
	
	const { data: allCriteria } = await supabaseAdmin
		.from('criteria')
		.select('id, name, category, section, max_points')
		.order('section')
		.order('sort_order');

	const { rows, error: fetchErr } = await fetchRankings(supabaseAdmin, {
		categories: categories as any[],
		themes: [],
		schools: [],
		statuses: ['submitted', 'finalised'] // Only export submitted/finalised
	});

	if (fetchErr) {
		throw error(500, fetchErr);
	}

	const participantIds = rows.map((r) => r.participantId);
	const { data: allScoresheets } = await supabaseAdmin
		.from('scoresheets')
		.select('id, participant_id')
		.in('participant_id', participantIds)
		.in('status', ['submitted', 'finalised']);

	const sheetIds = allScoresheets?.map((s) => s.id) || [];
	const { data: allScores } = await supabaseAdmin
		.from('scores')
		.select('scoresheet_id, criterion_id, points')
		.in('scoresheet_id', sheetIds);

	const scoreMap = new Map();
	for (const sheet of allScoresheets || []) {
		if (!scoreMap.has(sheet.participant_id)) scoreMap.set(sheet.participant_id, new Map());
		const pMap = scoreMap.get(sheet.participant_id);
		const sheetScores = allScores?.filter((s) => s.scoresheet_id === sheet.id) || [];
		for (const s of sheetScores) {
			pMap.set(s.criterion_id, s.points);
		}
	}

	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'P3 Robotics';
	workbook.created = new Date();

	// Cover sheet
	const cover = workbook.addWorksheet('Overview');
	cover.columns = [{ width: 30 }, { width: 50 }];
	cover.addRow(['Event', 'P3 Robotics Competition']);
	cover.addRow(['Export Date', new Date().toLocaleString()]);
	cover.addRow(['Total Participants Scored', rows.length]);
	cover.getColumn(1).font = { bold: true };

	// Create a worksheet for each category
	for (const category of ['A', 'B', 'C']) {
		if (!categories.includes(category)) continue;

		const catRows = rows.filter((r) => r.category === category);
		if (catRows.length === 0) continue;

		const sheet = workbook.addWorksheet(`Category ${category}`);
		
		const catCriteria = (allCriteria || []).filter((c) => c.category === category);
		
		const baseColumns = [
			{ header: 'Rank', key: 'rank', width: 10 },
			{ header: 'Participant', key: 'participantName', width: 30 },
			{ header: 'School', key: 'schoolName', width: 30 },
			{ header: 'Theme', key: 'theme', width: 20 }
		];
		
		const criteriaColumns = catCriteria.map((c) => ({
			header: `${c.name} [${c.section}] (${c.max_points})`,
			key: `crit_${c.id}`,
			width: 20
		}));
		
		const endColumns = [
			{ header: 'Total Score', key: 'totalPoints', width: 15 },
			{ header: 'Sprint Time', key: 'sprintTime', width: 15 },
			{ header: 'Judge', key: 'judgeName', width: 25 },
			{ header: 'Status', key: 'scoresheetStatus', width: 15 }
		];

		sheet.columns = [...baseColumns, ...criteriaColumns, ...endColumns];

		// Style header
		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
		sheet.getRow(1).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF4F46E5' } // Indigo 600
		};
		sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
		sheet.getRow(1).height = 30;

		for (const row of catRows) {
			let sprintTime = '—';
			if (row.liveSprintTimeSeconds !== null) {
				const mins = Math.floor(row.liveSprintTimeSeconds / 60);
				const secs = row.liveSprintTimeSeconds % 60;
				sprintTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
			}
			
			const rowData: any = {
				rank: row.rank,
				participantName: row.participantName,
				schoolName: row.schoolName,
				theme: row.theme || '—',
				totalPoints: row.totalPoints,
				sprintTime: sprintTime,
				judgeName: row.judgeName,
				scoresheetStatus: row.scoresheetStatus
			};

			const pMap = scoreMap.get(row.participantId);
			if (pMap) {
				for (const c of catCriteria) {
					rowData[`crit_${c.id}`] = pMap.get(c.id) ?? 0;
				}
			}

			const addedRow = sheet.addRow(rowData);
			
			// Highlight top 3
			if (row.rank && row.rank <= 3) {
				addedRow.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: 'FFFDFEE6' } // Light yellow for podium
				};
			}
		}

		// Apply borders and formatting
		sheet.eachRow((row, rowNumber) => {
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
					left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
					bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
					right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
				};
				if (rowNumber > 1) {
					// align numbers to center
					const colKey = String((cell as any)._column?.key);
					if (colKey === 'rank' || colKey === 'totalPoints' || colKey === 'sprintTime' || colKey.startsWith('crit_')) {
						cell.alignment = { horizontal: 'center' };
					}
				}
			});
		});
	}

	if (workbook.worksheets.length === 1) { // Only Overview exists
		const sheet = workbook.addWorksheet('No Data');
		sheet.getCell('A1').value = 'No finalised/submitted results found.';
	}

	const buffer = await workbook.xlsx.writeBuffer();

	return new Response(buffer as ArrayBuffer, {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="P3_Competition_Results_${new Date().toISOString().slice(0, 10)}.xlsx"`
		}
	});
};
