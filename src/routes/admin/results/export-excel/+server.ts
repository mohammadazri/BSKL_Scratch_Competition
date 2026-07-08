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
	
	const { rows, error: fetchErr } = await fetchRankings(supabaseAdmin, {
		categories: categories as any[],
		themes: [],
		schools: [],
		statuses: ['submitted', 'finalised'] // Only export submitted/finalised
	});

	if (fetchErr) {
		throw error(500, fetchErr);
	}

	const workbook = new ExcelJS.Workbook();
	workbook.creator = 'P3 Robotics';
	workbook.created = new Date();

	// Create a worksheet for each category
	for (const category of ['A', 'B', 'C']) {
		if (!categories.includes(category)) continue;
		
		const catRows = rows.filter(r => r.category === category);
		if (catRows.length === 0) continue;

		const sheet = workbook.addWorksheet(`Category ${category}`);
		
		sheet.columns = [
			{ header: 'Rank', key: 'rank', width: 10 },
			{ header: 'Participant', key: 'participantName', width: 30 },
			{ header: 'School', key: 'schoolName', width: 30 },
			{ header: 'Theme', key: 'theme', width: 20 },
			{ header: 'Score', key: 'totalPoints', width: 15 },
			{ header: 'Sprint Time', key: 'sprintTime', width: 15 },
			{ header: 'Judge', key: 'judgeName', width: 25 },
			{ header: 'Status', key: 'scoresheetStatus', width: 15 },
		];

		// Style header
		sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
		sheet.getRow(1).fill = {
			type: 'pattern',
			pattern: 'solid',
			fgColor: { argb: 'FF4F46E5' } // Indigo 600
		};
		sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

		for (const row of catRows) {
			let sprintTime = '—';
			if (row.liveSprintTimeSeconds !== null) {
				const mins = Math.floor(row.liveSprintTimeSeconds / 60);
				const secs = row.liveSprintTimeSeconds % 60;
				sprintTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
			}
			
			sheet.addRow({
				rank: row.rank,
				participantName: row.participantName,
				schoolName: row.schoolName,
				theme: row.theme || '—',
				totalPoints: row.totalPoints,
				sprintTime: sprintTime,
				judgeName: row.judgeName,
				scoresheetStatus: row.scoresheetStatus,
			});
		}

		// Apply borders
		sheet.eachRow((row, rowNumber) => {
			row.eachCell((cell) => {
				cell.border = {
					top: { style: 'thin' },
					left: { style: 'thin' },
					bottom: { style: 'thin' },
					right: { style: 'thin' }
				};
				if (rowNumber > 1) {
					// align numbers to center
					if (cell._column.key === 'rank' || cell._column.key === 'totalPoints' || cell._column.key === 'sprintTime') {
						cell.alignment = { horizontal: 'center' };
					}
				}
			});
		});
	}

	if (workbook.worksheets.length === 0) {
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
