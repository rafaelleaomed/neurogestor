import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Legend } from 'recharts';
import { getSession, getSurgeries, saveSurgery, deleteSurgery, getUsers, saveSurgeriesBatch, deleteSurgeriesBatch, updateUserStatus, updateUserRole, deleteUser, updateUserFcmToken } from '../services/storage';
import { performBatchLabelsOCR, mapSpreadsheetWithAI } from '../services/gemini';
import { messaging } from '../services/firebase';
import { getToken } from 'firebase/messaging';

import { Surgery, Category, User } from '../types';
import { ADMIN_EMAIL, COMPLEXITY_CONFIG } from '../constants';
import { DocumentsTab } from './DocumentsTab';
import PortfolioTab from '../components/PortfolioTab';
import { formatCurrency, formatDate, exportToExcel, parseExcelFile, getCategoryFromText, normalizeForGrouping, compressImage, estimateScrews, normalizeCategory } from '../utils';

const Dashboard: React.FC<{ onLogout: () => void }> = ({ onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const batchLabelInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  const currentUser = getSession();

  const [activeTab, setActiveTab] = useState<'overview' | 'surgeries' | 'portfolio' | 'users' | 'documents'>(
    (location.state as any)?.activeTab || 'overview'
  );

  const isAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || currentUser?.role === 'admin' || currentUser?.role === 'owner';
  const isAssistant = currentUser?.role === 'assistant';
  const isOwner = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || currentUser?.role === 'owner';
  const isAdminEmail = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  const [viewScope, setViewScope] = useState<'personal' | 'global'>('personal');
  const [metricMode, setMetricMode] = useState<'revenue' | 'volume'>(isAssistant ? 'volume' : 'revenue');

  const [viewingEmail, setViewingEmail] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>(getUsers());

  const [surgeries, setSurgeries] = useState<Surgery[]>(getSurgeries());

  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [filterMonth, setFilterMonth] = useState<string>((new Date().getMonth() + 1).toString().padStart(2, '0'));

  // Lista de anos disponíveis para filtro (Histórico + Futuro)
  const availableYears = ['2023', '2024', '2025', '2026'];

  // Filtros exclusivos da aba Cirurgias (ano + mês separados do painel)
  const [filterYearSurgeries, setFilterYearSurgeries] = useState<string>(
    (location.state as any)?.filterYearSurgeries || new Date().getFullYear().toString()
  );
  const [filterMonthSurgeries, setFilterMonthSurgeries] = useState<string>(
    (location.state as any)?.filterMonthSurgeries || (new Date().getMonth() + 1).toString().padStart(2, '0')
  );
  const [rankingPeriod, setRankingPeriod] = useState<'month' | 'year' | 'total'>('year');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYearsChart, setSelectedYearsChart] = useState<string[]>(['2025', '2026']);
  const [selectedYearsYoy, setSelectedYearsYoy] = useState<string[]>(['2025', '2026']);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [processProgress, setProcessProgress] = useState(0);
  const [selectedSurgery, setSelectedSurgery] = useState<Surgery | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [batchReviewData, setBatchReviewData] = useState<Surgery[] | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Períodos das métricas
  const [avgTimePeriod, setAvgTimePeriod] = useState<'month' | 'general'>('month');
  const [mixPeriod, setMixPeriod] = useState<'month' | 'year' | 'total'>('month');

  const [isDarkMode, setIsDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [isPrivacyMode, setIsPrivacyMode] = useState(() => localStorage.getItem('neurogestor_privacy_mode') === 'true');

  const togglePrivacyMode = () => {
    setIsPrivacyMode(prev => {
      const next = !prev;
      localStorage.setItem('neurogestor_privacy_mode', String(next));
      return next;
    });
  };

  // Helper: exibe valor monetário ou máscara de privacidade
  const fmtMoney = (value: number) => isPrivacyMode ? '••••••' : formatCurrency(value);

  // Helper: exibe nome do paciente real ou máscara de privacidade (LGPD / Demonstração)
  const formatPatientName = (name?: string) => {
    if (!name) return 'NÃO INFORMADO';
    if (!isPrivacyMode) return name;
    return name
      .trim()
      .split(/\s+/)
      .map(part => part[0] ? part[0].toUpperCase() + '.' : '')
      .join(' ') + ' (Anonimizado)';
  };

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };



  // Recarrega cirurgias sempre que a aba mudar ou após ações
  const refreshData = () => {
    setSurgeries(getSurgeries());
    setAllUsers(getUsers());
  };

  /**
   * Verifica duplicatas: mesmo paciente no mesmo mês (YYYY-MM).
   * Compara contra cirurgias que já existem no banco.
   */
  const checkDuplicates = (newSurgeries: Surgery[]): Surgery[] => {
    const existingSurgeries = getSurgeries();
    return newSurgeries.map(ns => {
      const nsMonth = ns.data?.slice(0, 7); // 'YYYY-MM'
      const nsName = ns.paciente?.toUpperCase().trim();
      if (!nsMonth || !nsName) return ns;

      // Verifica contra cirurgias existentes
      const existingMatch = existingSurgeries.find(es => {
        const esMonth = es.data?.slice(0, 7);
        const esName = es.paciente?.toUpperCase().trim();
        return esMonth === nsMonth && esName === nsName;
      });

      // Verifica contra outros itens do mesmo lote
      const batchMatch = newSurgeries.find(other => {
        if (other.id === ns.id) return false;
        const otherMonth = other.data?.slice(0, 7);
        const otherName = other.paciente?.toUpperCase().trim();
        return otherMonth === nsMonth && otherName === nsName;
      });

      if (existingMatch || batchMatch) {
        return { ...ns, possivel_duplicata: true };
      }
      return ns;
    });
  };

  useEffect(() => {
    refreshData();
    setSelectedIds(new Set());
  }, [activeTab]);

  useEffect(() => {
    const requestNotificationPermission = async () => {
      if (!currentUser?.email) return;
      if (!messaging) return; // Not supported in this browser

      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          try {
            const token = await getToken(messaging);
            if (token) {
              console.log('FCM Token generated:', token);
              await updateUserFcmToken(currentUser.email, token);
            }
          } catch (tokenError) {
            console.error('Error getting FCM token (may need VAPID key setup in Firebase):', tokenError);
          }
        }
      } catch (error) {
        console.error('Error requesting notification permission:', error);
      }
    };

    requestNotificationPermission();
  }, [currentUser?.email]);

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = (list: Surgery[]) => {
    if (selectedIds.size === list.length && list.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map(s => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (window.confirm(`Deseja excluir os ${selectedIds.size} registros selecionados?`)) {
      setIsProcessing(true);
      setProcessingMsg('Excluindo registros selecionados...');
      setProcessProgress(0);
      try {
        await deleteSurgeriesBatch(Array.from(selectedIds), (p) => {
          setProcessProgress(p);
          setProcessingMsg(`Excluindo registros... ${Math.round(p)}%`);
        });
        setSelectedIds(new Set());
        refreshData();
      } catch (err) {
        console.error('Erro ao excluir:', err);
        alert('Ocorreu um erro ao tentar excluir os registros.');
      } finally {
        setIsProcessing(false);
        setProcessProgress(0);
      }
    }
  };

  const mySurgeries = useMemo(() => {
    if (isAssistant || (isOwner && viewScope === 'global')) {
      return surgeries;
    }
    return surgeries.filter(s => {
      // Filtragem por proprietário (Tenny)
      const targetEmail = viewingEmail || currentUser?.email;
      const belongsToTarget = s.owner_email === targetEmail || (!s.owner_email && targetEmail === currentUser?.email);
      return belongsToTarget;
    });
  }, [surgeries, viewingEmail, currentUser, isAssistant, isOwner, viewScope]);

  const filteredSurgeries = useMemo(() => {
    const filtered = mySurgeries.filter(s => {
      const searchLower = searchTerm.toLowerCase();

      const ptName = s.paciente?.toLowerCase() || '';
      const procName = s.procedimento?.toLowerCase() || '';
      const hospName = s.hospital?.toLowerCase() || '';
      const docName = s.medico?.toLowerCase() || '';

      const matchesSearch = searchTerm === '' ||
        ptName.includes(searchLower) ||
        procName.includes(searchLower) ||
        hospName.includes(searchLower) ||
        docName.includes(searchLower);

      // Se houver busca global, ignora o filtro de data padrão (só se quiser forçar o ano a gente checaria, mas melhor ser full global)
      const matchesDate = searchTerm !== '' ? true : (filterMonthSurgeries === 'all'
        ? s.data.startsWith(filterYearSurgeries)
        : s.data.startsWith(`${filterYearSurgeries}-${filterMonthSurgeries}`));

      return matchesDate && matchesSearch;
    }).sort((a, b) => {
      const dateA = new Date(a.data).getTime();
      const dateB = new Date(b.data).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    // Detecção dinâmica de duplicatas para a listagem atual
    const seenSignatures = new Set<string>();
    return filtered.map(s => {
      let isDuplicate = false;
      const ptName = s.paciente?.trim().toLowerCase() || '';
      const dataMonth = s.data ? s.data.slice(0, 7) : ''; // YYYY-MM
      const hospitalName = s.hospital ? s.hospital.trim().toLowerCase() : '';

      // Assinatura de unicidade: Paciente + Mês/Ano (e Hospital opcionalmente se for o mesmo, para ser ainda mais garantido que é a mesma cirurgia)
      const signature = `${ptName}|${dataMonth}|${hospitalName}`;

      if (signature.length > 4) { // Impede string vazia
        if (seenSignatures.has(signature)) {
          isDuplicate = true;
        } else {
          seenSignatures.add(signature);
        }
      }

      return { ...s, possivel_duplicata: isDuplicate };
    });
  }, [mySurgeries, filterYearSurgeries, filterMonthSurgeries, searchTerm, sortOrder, isAdmin]);

  const stats = useMemo(() => {
    // Cards "Mês Atual" sempre usam o mês/ano REAL do sistema
    const realMonth = new Date().getMonth() + 1;
    const realYear = new Date().getFullYear().toString();
    const realMonthPrefix = `${realYear}-${realMonth.toString().padStart(2, '0')}`;
    const monthSurgeries = mySurgeries.filter(s => s.data.startsWith(realMonthPrefix));
    const yearSurgeries = mySurgeries.filter(s => s.data.startsWith(filterYear));

    // Cálculo do Tempo Médio e Ganhos por Hora
    // Filtra cirurgias baseado no período selecionado (Mês Atual ou Geral)
    const timeTargetSurgeries = avgTimePeriod === 'month' ? monthSurgeries : yearSurgeries;

    const surgeriesWithTime = timeTargetSurgeries.filter(s => s.hora_inicio && s.hora_fim);
    let totalMins = 0;
    let totalRevenueWithTime = 0;

    surgeriesWithTime.forEach(s => {
      const start = s.hora_inicio!.split(':').map(Number);
      const end = s.hora_fim!.split(':').map(Number);
      if (start.length === 2 && end.length === 2) {
        let diff = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
        if (diff < 0) diff += 24 * 60; // virou a noite
        totalMins += diff;
        totalRevenueWithTime += s.valor_estimado;
      }
    });

    const avgMins = surgeriesWithTime.length > 0 ? Math.round(totalMins / surgeriesWithTime.length) : 0;
    const avgDurationStr = avgMins > 0 ? `${Math.floor(avgMins / 60)}h${(avgMins % 60).toString().padStart(2, '0')}m` : '--';

    // Ganho por Hora (Total R$ das cirurgias com tempo / Total Horas)
    const totalHours = totalMins / 60;
    const hourlyRate = totalHours > 0 ? totalRevenueWithTime / totalHours : 0;

    return {
      monthCount: monthSurgeries.length,
      monthRevenue: monthSurgeries.reduce((acc, s) => acc + s.valor_estimado, 0),
      yearCount: yearSurgeries.length,
      yearRevenue: yearSurgeries.reduce((acc, s) => acc + s.valor_estimado, 0),
      avgDuration: avgDurationStr,
      hourlyRate: hourlyRate
    };
  }, [mySurgeries, filterYear, avgTimePeriod]);

  // ── Estimativa de Parafusos ──────────────────────────────────
  const screwStats = useMemo(() => {
    const realMonth = new Date().getMonth() + 1;
    const realYear = new Date().getFullYear().toString();
    const realMonthPrefix = `${realYear}-${realMonth.toString().padStart(2, '0')}`;

    const getScrew = (s: Surgery) => {
      const subtipo = (s.subtipo || '').toLowerCase();
      const proc = (s.procedimento || '').toLowerCase();
      if (subtipo.includes('cervical') || proc.includes('cervical')) return 0;
      return s.estimated_screws || 0;
    };

    const totalAll = mySurgeries.reduce((acc, s) => acc + getScrew(s), 0);
    const totalYear = mySurgeries
      .filter(s => s.data.startsWith(filterYear))
      .reduce((acc, s) => acc + getScrew(s), 0);
    const totalMonth = mySurgeries
      .filter(s => s.data.startsWith(realMonthPrefix))
      .reduce((acc, s) => acc + getScrew(s), 0);

    return { totalAll, totalYear, totalMonth };
  }, [mySurgeries, filterYear]);

  const doctorSummaries = useMemo(() => {
    // Calculamos o resumo baseado no filtro de ano atual
    const yearSurgeries = mySurgeries.filter(s => s.data.startsWith(filterYear));
    const map: Record<string, { total: number; cranio: number; coluna: number; nervo: number; totalMins: number; countWithTime: number }> = {};

    yearSurgeries.forEach(s => {
      const name = s.medico || 'NOME NÃO INFORMADO';
      if (!map[name]) {
        map[name] = { total: 0, cranio: 0, coluna: 0, nervo: 0, totalMins: 0, countWithTime: 0 };
      }
      map[name].total++;
      if (s.categoria === Category.CRANIO) map[name].cranio++;
      if (s.categoria === Category.COLUNA) map[name].coluna++;
      if (s.categoria === Category.NERVO_PERIFERICO) map[name].nervo++;

      if (s.hora_inicio && s.hora_fim) {
        const start = s.hora_inicio.split(':').map(Number);
        const end = s.hora_fim.split(':').map(Number);
        if (start.length === 2 && end.length === 2) {
          let diff = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
          if (diff < 0) diff += 24 * 60;
          map[name].totalMins += diff;
          map[name].countWithTime++;
        }
      }
    });

    return Object.entries(map).map(([name, data]) => {
      const avgMins = data.countWithTime > 0 ? Math.round(data.totalMins / data.countWithTime) : 0;
      const avgStr = avgMins > 0 ? `${Math.floor(avgMins / 60)}h${(avgMins % 60).toString().padStart(2, '0')}m` : '--';
      return { name, ...data, avgDuration: avgStr };
    }).sort((a, b) => b.total - a.total);
  }, [mySurgeries, filterYear]);

  const monthlyRevenueData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, i) => {
      const monthPrefix = `${filterYear}-${(i + 1).toString().padStart(2, '0')}`;
      const filtered = mySurgeries.filter(s => s.data.startsWith(monthPrefix));
      const value = metricMode === 'volume' ? filtered.length : filtered.reduce((acc, s) => acc + s.valor_estimado, 0);
      return { name: m, value: value };
    });
  }, [mySurgeries, filterYear, metricMode]);

  const categoryChartData = useMemo(() => {
    const map: Record<string, number> = {};
    const realMonth = new Date().getMonth() + 1;
    const realYear = new Date().getFullYear().toString();
    const realMonthPrefix = `${realYear}-${realMonth.toString().padStart(2, '0')}`;
    const prefix = mixPeriod === 'month' ? realMonthPrefix : mixPeriod === 'year' ? filterYear : '';

    const filtered = mixPeriod === 'total' ? mySurgeries : mySurgeries.filter(s => s.data.startsWith(prefix));
    filtered.forEach(s => {
      const cat = normalizeCategory(s.categoria);
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [mySurgeries, filterYear, mixPeriod]);

  const topSurgeons = useMemo(() => {
    const counts: Record<string, { displayName: string; count: number }> = {};
    const realMonth = new Date().getMonth() + 1;
    const realYear = new Date().getFullYear().toString();
    const realMonthPrefix = `${realYear}-${realMonth.toString().padStart(2, '0')}`;

    let filtered: Surgery[];
    if (rankingPeriod === 'month') {
      filtered = mySurgeries.filter(s => s.data.startsWith(realMonthPrefix));
    } else if (rankingPeriod === 'year') {
      filtered = mySurgeries.filter(s => s.data.startsWith(filterYear));
    } else {
      filtered = mySurgeries;
    }

    filtered.forEach(s => {
      const raw = s.medico || 'Não Informado';
      const key = normalizeForGrouping(raw, 'doctor');
      if (!counts[key]) {
        counts[key] = { displayName: raw, count: 0 };
      }
      counts[key].count++;
      if (raw.length > counts[key].displayName.length) {
        counts[key].displayName = raw;
      }
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    const max = Math.max(...sorted.map(s => s.count), 1);
    return sorted.map(({ displayName, count }) => ({ name: displayName, count, percentage: (count / max) * 100 }));
  }, [mySurgeries, rankingPeriod, filterYear]);

  const topHospitals = useMemo(() => {
    const counts: Record<string, { displayName: string; count: number }> = {};
    const realMonth = new Date().getMonth() + 1;
    const realYear = new Date().getFullYear().toString();
    const realMonthPrefix = `${realYear}-${realMonth.toString().padStart(2, '0')}`;

    let filtered: Surgery[];
    if (rankingPeriod === 'month') {
      filtered = mySurgeries.filter(s => s.data.startsWith(realMonthPrefix));
    } else if (rankingPeriod === 'year') {
      filtered = mySurgeries.filter(s => s.data.startsWith(filterYear));
    } else {
      filtered = mySurgeries;
    }

    filtered.forEach(s => {
      const raw = s.hospital || 'Não Informado';
      const key = normalizeForGrouping(raw, 'hospital');
      if (!counts[key]) {
        counts[key] = { displayName: raw, count: 0 };
      }
      counts[key].count++;
      if (raw.length > counts[key].displayName.length) {
        counts[key].displayName = raw;
      }
    });
    const sorted = Object.values(counts).sort((a, b) => b.count - a.count);
    const max = Math.max(...sorted.map(s => s.count), 1);
    return sorted.map(({ displayName, count }) => ({ name: displayName, count, percentage: (count / max) * 100 }));
  }, [mySurgeries, rankingPeriod, filterYear]);

  const yoyComparisonData = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return months.map((m, i) => {
      const monthStr = (i + 1).toString().padStart(2, '0');
      const dataPoint: any = { name: m };
      
      selectedYearsYoy.forEach(year => {
        const filtered = mySurgeries.filter(s => s.data.startsWith(`${year}-${monthStr}`));
        dataPoint[year] = metricMode === 'volume' 
          ? filtered.length 
          : filtered.reduce((acc, s) => acc + s.valor_estimado, 0);
      });
      
      return dataPoint;
    });
  }, [mySurgeries, selectedYearsYoy, metricMode]);

  const CATEGORY_COLORS: Record<string, string> = {
    [Category.COLUNA]: '#10b981',
    [Category.CRANIO]: '#f59e0b',
    [Category.NERVO_PERIFERICO]: '#8b5cf6',
    'COLUNA': '#10b981',
    'CRANIO': '#f59e0b',
    'NERVO PERIFERICO': '#8b5cf6',
    'Coluna': '#10b981',
    'Crânio': '#f59e0b',
    'Nervo Periférico': '#8b5cf6'
  };

  const currentListTotal = useMemo(() => {
    return filteredSurgeries.reduce((acc, s) => acc + s.valor_estimado, 0);
  }, [filteredSurgeries]);

  const handleFilterByDoctor = (doctorName: string) => {
    // Remove prefixos DR/DRA para busca ampla de todas as variações no banco
    const clean = doctorName.replace(/^(DR|DRA)\.?\s+/i, '').trim();
    setSearchTerm(clean || doctorName);
    setActiveTab('surgeries');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterByHospital = (hospitalName: string) => {
    const clean = hospitalName.replace(/^(HOSPITAL|HOSP\.?|HP)\s+/i, '').trim();
    setSearchTerm(clean || hospitalName);
    setActiveTab('surgeries');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSurgery = async (e: React.MouseEvent, s: Surgery) => {
    e.stopPropagation();
    if (confirm(`Excluir permanentemente o registro de ${s.paciente}?`)) {
      try {
        await deleteSurgery(s.id);
        const newSelected = new Set(selectedIds);
        newSelected.delete(s.id);
        setSelectedIds(newSelected);
        refreshData();
        if (selectedSurgery?.id === s.id) setSelectedSurgery(null);
      } catch (err) {
        console.error('[NeuroGestor] Erro ao excluir cirurgia:', err);
        alert('Ocorreu um erro ao excluir o registro. Tente novamente.');
      }
    }
  };

  const handleDeleteDuplicates = async () => {
    const duplicates = filteredSurgeries.filter(s => s.possivel_duplicata);
    if (duplicates.length === 0) {
      alert("Nenhuma possível duplicata encontrada na listagem atual.");
      return;
    }
    if (confirm(`Atenção: Você está prestes a excluir ${duplicates.length} possível(is) duplicada(s) desta lista. Deseja continuar?`)) {
      setIsProcessing(true);
      setProcessingMsg(`Excluindo ${duplicates.length} registros...`);
      setProcessProgress(0);

      try {
        const idsToDelete = duplicates.map(d => d.id).filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
        if (idsToDelete.length === 0) {
          alert("Não foi possível determinar os IDs válidos para exclusão.");
          return;
        }

        await deleteSurgeriesBatch(idsToDelete, (p) => {
          setProcessProgress(p);
          setProcessingMsg(`Excluindo duplicatas... ${Math.round(p)}%`);
        });

        refreshData();
        alert(`${idsToDelete.length} duplicatas excluídas com sucesso!`);
      } catch (err) {
        console.error('Erro ao excluir duplicatas:', err);
        alert('Ocorreu um erro ao excluir duplicatas.');
      } finally {
        setIsProcessing(false);
        setProcessProgress(0);
      }
    }
  };

  const handleBatchLabelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setIsProcessing(true);
    setProcessingMsg(`IA Analisando ${files.length} etiquetas...`);

    const base64Images: string[] = [];
    for (const file of files) {
      try {
        const b64 = await compressImage(file, 1600, 0.85);
        base64Images.push(b64);
      } catch (err) {
        console.error("Erro ao comprimir imagem em lote:", err);
      }
    }

    try {
      setProcessProgress(0);
      const results = await performBatchLabelsOCR(base64Images, (processed, total) => {
        setProcessingMsg(`IA processando... ${processed}/${total} etiquetas`);
        setProcessProgress((processed / total) * 100);
      });
      if (results.length === 0) {
        alert(`Nenhuma cirurgia identificada nas ${files.length} etiquetas. Tente novamente com imagens mais nítidas.`);
      } else {
        // Verifica duplicatas antes de mostrar review
        const checked = checkDuplicates(results);
        const dupeCount = checked.filter(s => s.possivel_duplicata).length;
        if (dupeCount > 0) {
          alert(`⚠️ ${dupeCount} possível(is) duplicata(s) detectada(s)! Revise os itens destacados em amarelo antes de confirmar.`);
        }
        setBatchReviewData(checked);
      }
    } catch (err) {
      alert("Cota da IA atingida. Tente novamente em alguns segundos.");
    } finally {
      setIsProcessing(false);
      if (batchLabelInputRef.current) batchLabelInputRef.current.value = '';
    }
  };

  const saveReviewedBatch = () => {
    if (!batchReviewData) return;

    // Validação de campos essenciais
    const invalidItems = batchReviewData.filter(item => !item.paciente || !item.procedimento || !item.data);
    if (invalidItems.length > 0) {
      alert("Existem itens com campos obrigatórios vazios (Paciente, Procedimento ou Data). Por favor, preencha todos antes de salvar.");
      return;
    }

    const dupeCount = batchReviewData.filter(s => s.possivel_duplicata).length;
    if (dupeCount > 0) {
      const confirmed = confirm(`⚠️ Existem ${dupeCount} possível(is) duplicata(s).\n\nDeseja salvar mesmo assim? Elas ficarão marcadas na tabela de cirurgias para revisão posterior.`);
      if (!confirmed) return;
    }

    saveSurgeriesBatch(batchReviewData);
    refreshData();
    setBatchReviewData(null);
    setProcessProgress(0);
    setActiveTab('surgeries');
    alert(`${batchReviewData.length} registros salvos com sucesso na tabela.`);
  };

  const removeReviewItem = (index: number) => {
    if (!batchReviewData) return;
    const newData = batchReviewData.filter((_, i) => i !== index);
    setBatchReviewData(newData.length > 0 ? newData : null);
  };

  const dismissDuplicate = (index: number) => {
    if (!batchReviewData) return;
    const newData = [...batchReviewData];
    newData[index] = { ...newData[index], possivel_duplicata: false };
    setBatchReviewData(newData);
  };

  const updateReviewItem = (index: number, field: keyof Surgery, value: string) => {
    if (!batchReviewData) return;
    const newData = [...batchReviewData];
    (newData[index] as any)[field] = value;
    if (field === 'procedimento') {
      newData[index].categoria = getCategoryFromText(value);
    }
    setBatchReviewData(newData);
  };



  const handleExport = () => {
    try {
      const monthLabel = filterMonthSurgeries === 'all'
        ? 'Ano Completo'
        : new Date(parseInt(filterYearSurgeries), parseInt(filterMonthSurgeries) - 1)
          .toLocaleString('pt-BR', { month: 'long' });
      exportToExcel(filteredSurgeries, currentUser, monthLabel, filterYearSurgeries);
    } catch (error) {
      console.error("Erro ao exportar:", error);
      alert(`Ocorreu um erro ao gerar a planilha: ${error instanceof Error ? error.message : 'Erro Desconhecido'}`);
    }
  };

  const handleSpreadsheetImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessing(true);
      setProcessingMsg('Mapeando Planilha com IA...');
      const raw = await parseExcelFile(file);
      const mapped = await mapSpreadsheetWithAI(raw);
      if (mapped.length > 0) {
        saveSurgeriesBatch(mapped);
        refreshData();

        // Tenta ajustar o filtro para o mês do primeiro item importado
        if (mapped[0].data) {
          const parts = mapped[0].data.split('-');
          if (parts.length === 3) {
            setFilterYear(parts[0]);
            setFilterMonth(parts[1]);
          }
        }

        setActiveTab('surgeries');
        alert(`${mapped.length} registros identificados e importados!`);
      } else {
        alert("A IA não conseguiu identificar dados válidos na planilha.");
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao processar planilha. Certifique-se que o arquivo é um Excel válido.");
    } finally {
      setIsProcessing(false);
      setProcessProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0f18] pb-20 font-display transition-colors duration-500 selection:bg-primary/30 relative">
      {/* Decorative Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 dark:bg-primary/10 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-screen animate-pulse duration-[10000ms]"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full blur-[100px] mix-blend-multiply dark:mix-blend-screen pointer-events-none"></div>
        <div className="absolute top-[40%] right-[10%] w-[20%] h-[20%] bg-amber-500/10 dark:bg-amber-500/5 rounded-full blur-[80px] pointer-events-none"></div>
      </div>

      <div className="relative z-10">
        {/* Lote Review Modal */}
        {batchReviewData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[80] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-6xl max-h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800 animate-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Conferência em Lote ({batchReviewData.length})</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase mt-1 tracking-widest">Revise os dados antes de confirmar o salvamento definitivo</p>
                </div>
                <button onClick={() => setBatchReviewData(null)} className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 rounded-full text-slate-400 hover:text-red-500 transition-all shadow-sm">
                  <span className="material-icons">close</span>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {batchReviewData.map((item, idx) => (
                  <div key={idx} className={`p-5 rounded-3xl grid grid-cols-1 md:grid-cols-4 gap-4 items-end border transition-colors relative ${item.possivel_duplicata ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 ring-2 ring-amber-200' : 'bg-slate-50 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:border-primary/30'}`}>
                    {/* Badge de duplicata */}
                    {item.possivel_duplicata && (
                      <div className="absolute -top-3 left-6 flex items-center gap-2">
                        <span className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                          <span className="material-icons text-xs">warning</span> POSSÍVEL DUPLICATA
                        </span>
                        <button onClick={() => dismissDuplicate(idx)} className="bg-white text-amber-600 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full shadow-sm hover:bg-amber-50 transition-colors" title="Marcar como NÃO duplicata">
                          Não é duplicata
                        </button>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Paciente</label>
                      <input type="text" value={item.paciente} onChange={e => updateReviewItem(idx, 'paciente', e.target.value)} className={`w-full border-none rounded-xl p-3 text-sm font-bold shadow-sm focus:ring-2 ring-primary/20 text-slate-900 dark:text-white ${item.possivel_duplicata ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-900'}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Procedimento</label>
                      <input type="text" value={item.procedimento} onChange={e => updateReviewItem(idx, 'procedimento', e.target.value)} className={`w-full border-none rounded-xl p-3 text-sm font-bold shadow-sm focus:ring-2 ring-primary/20 text-slate-900 dark:text-white ${item.possivel_duplicata ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-900'}`} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                      <input type="date" value={item.data} onChange={e => updateReviewItem(idx, 'data', e.target.value)} className={`w-full border-none rounded-xl p-3 text-sm font-bold shadow-sm focus:ring-2 ring-primary/20 text-slate-900 dark:text-white ${item.possivel_duplicata ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-900'}`} />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="space-y-1 flex-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hospital</label>
                        <input type="text" value={item.hospital} onChange={e => updateReviewItem(idx, 'hospital', e.target.value)} className={`w-full border-none rounded-xl p-3 text-sm font-bold shadow-sm focus:ring-2 ring-primary/20 text-slate-900 dark:text-white ${item.possivel_duplicata ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-900'}`} />
                      </div>
                      <button onClick={() => removeReviewItem(idx)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all" title="Remover item">
                        <span className="material-icons text-xl">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
                <button onClick={() => setBatchReviewData(null)} className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-500 font-black rounded-2xl shadow-sm hover:bg-slate-100 transition-colors uppercase text-xs tracking-widest">Cancelar</button>
                <button onClick={saveReviewedBatch} className="px-12 py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase text-xs tracking-widest">Confirmar Tudo</button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[70] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 space-y-8 animate-in zoom-in duration-200">
              <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Configurações</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Modo Escuro</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Aparência do sistema</p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 ${isDarkMode ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <div className={`w-6 h-6 bg-white rounded-full shadow-md transform transition-transform duration-300 flex items-center justify-center ${isDarkMode ? 'translate-x-6' : 'translate-x-0'}`}>
                      <span className="material-icons text-[14px] text-slate-700">{isDarkMode ? 'dark_mode' : 'light_mode'}</span>
                    </div>
                  </button>
                </div>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-2 text-slate-400 font-bold text-sm uppercase">Fechar</button>
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-2 text-slate-400 font-bold text-sm uppercase">Fechar</button>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center space-y-8 max-w-sm w-full border border-slate-100 dark:border-slate-800 animate-in zoom-in duration-300">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="material-icons text-primary animate-pulse text-xl">
                    {processingMsg.toLowerCase().includes('excluindo') ? 'delete_sweep' : 'biotech'}
                  </span>
                </div>
              </div>

              <div className="w-full space-y-4">
                <p className="font-black text-slate-900 dark:text-white text-center uppercase text-[10px] tracking-[0.2em] leading-relaxed px-4">{processingMsg}</p>

                {processProgress > 0 && (
                  <div className="space-y-2 px-2">
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700 ease-out rounded-full shadow-lg shadow-primary/20"
                        style={{ width: `${processProgress}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                      <span>Progresso</span>
                      <span className="text-primary">{Math.round(processProgress)}%</span>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Admin Viewing Banner */}
        {isAdmin && viewingEmail && (
          <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center justify-center gap-4 animate-in slide-in-from-top duration-300">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
              <span className="material-icons text-sm">visibility</span>
              Visualizando dados de: <span className="underline">{viewingEmail}</span>
            </span>
            <button
              onClick={() => { setViewingEmail(null); refreshData(); }}
              className="px-3 py-1 bg-primary text-white text-[9px] font-black rounded-lg uppercase tracking-widest hover:bg-primary/90 transition-all"
            >
              Voltar ao Meu Perfil
            </button>
          </div>
        )}

        {/* Header */}
        <header className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-100 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-1 sm:gap-4">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center flex-shrink-0">
                <img src="/logo.png" alt="NeuroGestor Logo" className="w-full h-full object-contain" />
              </div>
              <span className="text-base sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">NeuroGestor</span>
              {/* Desktop nav - hidden on mobile */}
              <nav className="hidden md:flex ml-4 space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                <button onClick={() => setActiveTab('overview')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Painel</button>
                <button onClick={() => setActiveTab('surgeries')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'surgeries' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Cirurgias</button>
                <button onClick={() => setActiveTab('portfolio')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'portfolio' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Portfólio</button>
                <button onClick={() => setActiveTab('documents')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'documents' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Documentos</button>
                {isAdmin && (
                  <button onClick={() => setActiveTab('users')} className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'users' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Usuários</button>
                )}
                {(isOwner || isAdminEmail) && (
                  <button onClick={() => navigate('/admin')} className="px-6 py-2 rounded-xl text-xs font-black transition-all text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none ml-2">ADMIN PANEL</button>
                )}
              </nav>
            </div>
            <div className="flex items-center space-x-0.5 sm:space-x-3 flex-shrink-0">
              {(currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() || currentUser?.role === 'owner' || currentUser?.role === 'admin') && (
                <button
                  onClick={() => navigate('/admin')}
                  title="Painel de Gestão"
                  className="p-1.5 sm:p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-all flex-shrink-0"
                >
                  <span className="material-icons text-xl sm:text-2xl">admin_panel_settings</span>
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('users')}
                  title="Gestão de Usuários"
                  className={`p-1.5 sm:p-2 transition-all rounded-xl flex-shrink-0 ${activeTab === 'users' ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <span className="material-icons text-xl sm:text-2xl">people</span>
                </button>
              )}
              <button onClick={() => setIsSettingsOpen(true)} title="Configurações" className="p-1.5 sm:p-2 text-slate-400 hover:text-primary hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all flex-shrink-0">
                <span className="material-icons text-xl sm:text-2xl">settings</span>
              </button>
              {!isAssistant && (
                <button
                  onClick={togglePrivacyMode}
                  title={isPrivacyMode ? 'Modo Privacidade LGPD Ativo (Nomes e Valores Ocultos)' : 'Modo Clínico Ativo (Nomes e Valores Visíveis)'}
                  className={`p-1.5 sm:p-2 transition-all rounded-xl flex-shrink-0 ${isPrivacyMode ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                >
                  <span className="material-icons text-xl sm:text-2xl">{isPrivacyMode ? 'shield' : 'visibility'}</span>
                </button>
              )}
              <div className="hidden sm:flex items-center space-x-3 text-right">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-white leading-none">{currentUser?.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{currentUser?.email}</p>
                </div>
                <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-sm">
                  <img src={currentUser?.picture || `https://ui-avatars.com/api/?name=${currentUser?.name}&background=135bec&color=fff`} className="w-full h-full object-cover" />
                </div>
              </div>
              <button onClick={onLogout} title="Sair" className="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors flex-shrink-0">
                <span className="material-icons text-xl sm:text-2xl">logout</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 z-50 px-2 py-1 safe-area-bottom shadow-lg">
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all ${
                activeTab === 'overview' ? 'text-primary font-black' : 'text-slate-400'
              }`}
            >
              <span className="material-icons text-2xl">dashboard</span>
              <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Painel</span>
            </button>

            <button
              onClick={() => setActiveTab('surgeries')}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all ${
                activeTab === 'surgeries' ? 'text-primary font-black' : 'text-slate-400'
              }`}
            >
              <span className="material-icons text-2xl">medical_services</span>
              <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Cirurgias</span>
            </button>

            {/* Central Floating Action Button (+) */}
            <div className="flex-1 flex justify-center -mt-5">
              <button
                onClick={() => navigate('/add', { state: { filterYearSurgeries, filterMonthSurgeries } })}
                className="bg-primary hover:bg-primary/90 text-white w-12 h-12 rounded-full shadow-lg shadow-primary/40 flex items-center justify-center transition-transform active:scale-95 flex-shrink-0"
                title="Nova Cirurgia"
              >
                <span className="material-icons text-2xl">add</span>
              </button>
            </div>

            <button
              onClick={() => setActiveTab('portfolio')}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all ${
                activeTab === 'portfolio' ? 'text-primary font-black' : 'text-slate-400'
              }`}
            >
              <span className="material-icons text-2xl">star</span>
              <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Portfólio</span>
            </button>

            <button
              onClick={() => setActiveTab('documents')}
              className={`flex-1 flex flex-col items-center py-1.5 rounded-xl transition-all ${
                activeTab === 'documents' ? 'text-primary font-black' : 'text-slate-400'
              }`}
            >
              <span className="material-icons text-2xl">folder</span>
              <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Docs</span>
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-10 pb-24 md:pb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-1">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{activeTab === 'overview' ? 'Performance' : 'Registros Cirúrgicos'}</h2>
              <p className="text-slate-500 font-medium text-sm sm:text-lg uppercase tracking-wider">{activeTab === 'overview' ? `Bem Vindo, Dr(a) ${currentUser?.name || ''}` : ''}{activeTab === 'overview' ? ' • ' : ''}{filterYear}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <input type="file" ref={batchLabelInputRef} onChange={handleBatchLabelUpload} accept="image/*" multiple className="hidden" />
              <input type="file" ref={cameraInputRef} onChange={handleBatchLabelUpload} accept="image/*" capture="environment" className="hidden" />
              {/* Camera menu for mobile */}
              <div className="relative">
                <button onClick={() => setShowCameraMenu(!showCameraMenu)} className="bg-amber-500 text-white px-4 sm:px-6 py-3 sm:py-3.5 rounded-2xl font-black shadow-lg shadow-amber-500/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all text-[10px] tracking-widest uppercase">
                  <span className="material-icons text-lg">auto_awesome</span> <span className="hidden sm:inline">ETIQUETAS EM LOTE</span><span className="sm:hidden">ETIQUETAS</span>
                </button>
                {showCameraMenu && (
                  <>
                    <div className="fixed inset-0 z-[45]" onClick={() => setShowCameraMenu(false)}></div>
                    <div className="absolute right-0 top-full mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-[46] w-72 animate-in slide-in-from-top-2 duration-200">
                      <button onClick={() => { cameraInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="material-icons text-amber-600">photo_camera</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Tirar Foto</p>
                          <p className="text-[10px] text-slate-400 font-bold">Abrir câmera do celular</p>
                        </div>
                      </button>
                      <div className="h-px bg-slate-100 dark:bg-slate-700"></div>
                      <button onClick={() => { batchLabelInputRef.current?.click(); setShowCameraMenu(false); }} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="material-icons text-primary">photo_library</span>
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Galeria</p>
                          <p className="text-[10px] text-slate-400 font-bold">Selecionar várias imagens</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => navigate('/add', { state: { filterYearSurgeries, filterMonthSurgeries } })} className="hidden md:flex relative overflow-hidden group bg-primary text-white px-8 py-3.5 rounded-2xl font-black shadow-2xl shadow-primary/40 items-center gap-2 hover:scale-105 active:scale-95 transition-all text-[10px] tracking-widest uppercase">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                <span className="material-icons text-xl relative z-10">add</span> <span className="relative z-10">NOVA CIRURGIA</span>
              </button>
            </div>
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-12 animate-in fade-in duration-500">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">

                {/* Cirurgias do Mês — Azul */}
                <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-[0_25px_50px_-12px_rgba(37,99,235,0.45)] group hover:scale-[1.02] transition-transform duration-300 border border-white/10">
                  {/* Aurora blob */}
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-sky-400/30 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                  <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-indigo-500/20 rounded-full blur-xl" />
                  {/* Border beam animation */}
                  <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.07) 50%, transparent 100%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                  <div className="relative z-10 flex flex-col h-full min-h-[120px] justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
                        <p className="text-[10px] font-black uppercase text-blue-200 tracking-widest">Mês Atual</p>
                      </div>
                      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                        <span className="material-icons text-lg text-blue-200">monitor_heart</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-3xl xl:text-4xl font-black tracking-tighter tabular-nums drop-shadow">{stats.monthCount}</p>
                      <p className="text-[10px] font-bold mt-1.5 text-blue-200 uppercase tracking-widest">Cirurgias Realizadas</p>
                    </div>
                  </div>
                </div>

                {/* Faturamento do Mês — Verde */}
                {!isAssistant && (
                  <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 text-white shadow-[0_25px_50px_-12px_rgba(16,185,129,0.4)] group hover:scale-[1.02] transition-transform duration-300 border border-white/10">
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-teal-300/25 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-emerald-800/20 rounded-full blur-xl" />
                    <div className="relative z-10 flex flex-col h-full min-h-[120px] justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                          <p className="text-[10px] font-black uppercase text-emerald-200 tracking-widest">Mês Atual</p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                          <span className="material-icons text-lg text-emerald-200">payments</span>
                        </div>
                      </div>
                      <div>
                        <p className={`font-black tracking-tighter drop-shadow ${isPrivacyMode ? 'text-2xl' : 'text-xl xl:text-2xl'}`}>{fmtMoney(stats.monthRevenue)}</p>
                        <p className="text-[10px] font-bold mt-1.5 text-emerald-200 uppercase tracking-widest">Faturamento Estimado</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Duração Média — Rosa */}
                {!isAssistant && (
                  <div className="relative overflow-hidden rounded-3xl p-6 bg-gradient-to-br from-rose-500 via-rose-600 to-red-700 text-white shadow-[0_25px_50px_-12px_rgba(225,29,72,0.4)] group hover:scale-[1.02] transition-transform duration-300 border border-white/10">
                    <div className="absolute -top-8 -right-8 w-32 h-32 bg-pink-400/25 rounded-full blur-2xl group-hover:scale-125 transition-transform duration-700" />
                    <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-rose-800/20 rounded-full blur-xl" />
                    <div className="relative z-10 flex flex-col h-full min-h-[120px] justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-pulse" />
                          <p className="text-[10px] font-black uppercase text-rose-200 tracking-widest">{avgTimePeriod === 'month' ? 'Tempo/Mês' : 'Tempo Geral'}</p>
                        </div>
                        <div className="flex bg-white/10 rounded-lg p-0.5">
                          <button onClick={() => setAvgTimePeriod('month')} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${avgTimePeriod === 'month' ? 'bg-white text-rose-600 shadow-sm' : 'text-rose-100'}`}>Mês</button>
                          <button onClick={() => setAvgTimePeriod('general')} className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-tighter transition-all ${avgTimePeriod === 'general' ? 'bg-white text-rose-600 shadow-sm' : 'text-rose-100'}`}>Geral</button>
                        </div>
                      </div>
                      <div>
                        <p className="text-2xl xl:text-3xl font-black tracking-tighter drop-shadow">{stats.avgDuration}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-[10px] font-bold text-rose-200 uppercase tracking-tight">Duração Média</p>
                          <div className="text-right">
                            <p className="text-[9px] font-black text-rose-300 uppercase tracking-widest">R$/Hora</p>
                            <p className="text-xs font-black text-white">{fmtMoney(stats.hourlyRate)}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total Acumulado — Glassmorphism */}
                <div className="relative overflow-hidden rounded-3xl p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl text-slate-900 dark:text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-none group hover:scale-[1.02] transition-transform duration-300 border border-white/30 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600">
                  <div className="absolute -top-6 -right-6 w-20 h-20 bg-slate-200/40 dark:bg-slate-700/30 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
                  <div className="relative z-10 flex flex-col h-full min-h-[120px] justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <span className="material-icons text-lg text-slate-500 dark:text-slate-400">functions</span>
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">{filterYear}</span>
                    </div>
                    <div>
                      <p className="text-3xl xl:text-4xl font-black tracking-tighter tabular-nums">{stats.yearCount}</p>
                      <p className="text-[10px] font-bold mt-1.5 text-slate-500 dark:text-slate-400 uppercase tracking-widest">Registros no Ano</p>
                    </div>
                  </div>
                </div>

                {/* Receita Anual — Glassmorphism Âmbar */}
                {!isAssistant && (
                  <div className="relative overflow-hidden rounded-3xl p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-2xl text-slate-900 dark:text-white shadow-[0_25px_50px_-12px_rgba(0,0,0,0.08)] dark:shadow-none group hover:scale-[1.02] transition-transform duration-300 border border-amber-200/60 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-700/50">
                    <div className="absolute -top-6 -right-6 w-20 h-20 bg-amber-200/40 dark:bg-amber-800/20 rounded-full blur-xl group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative z-10 flex flex-col h-full min-h-[120px] justify-between">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
                          <span className="material-icons text-lg text-amber-600 dark:text-amber-400">account_balance</span>
                        </div>
                        <span className="text-[9px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest bg-amber-50 dark:bg-amber-900/30 px-2 py-1 rounded-lg">Previsão Bruta</span>
                      </div>
                      <div>
                        <p className={`font-black tracking-tighter text-slate-900 dark:text-white ${isPrivacyMode ? 'text-2xl' : 'text-lg xl:text-xl'}`}>{fmtMoney(stats.yearRevenue)}</p>
                        <p className="text-[10px] font-bold mt-1.5 text-slate-500 dark:text-slate-400 uppercase tracking-widest">Receita Anual {filterYear}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl shadow-slate-200/20 dark:shadow-none border border-white/20 dark:border-slate-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-10 gap-4">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-6 bg-primary rounded-full"></span> Crescimento Mensal
                    </h3>
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                      {isOwner && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl mr-1 flex-shrink-0">
                          <button onClick={() => setViewScope('personal')} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${viewScope === 'personal' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Pessoal</button>
                          <button onClick={() => setViewScope('global')} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${viewScope === 'global' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Empresa</button>
                        </div>
                      )}
                      {!isAssistant && (
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex-shrink-0">
                          <button onClick={() => setMetricMode('revenue')} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${metricMode === 'revenue' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Faturamento</button>
                          <button onClick={() => setMetricMode('volume')} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${metricMode === 'volume' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}>Volume</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyRevenueData} margin={{ left: metricMode === 'volume' ? -15 : -10, right: 10, top: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="colorHospital" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#0f766e" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="colorSurgeon" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#7e22ce" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="colorPrevYear" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="5%" stopColor="#cbd5e1" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.9} />
                          </linearGradient>
                          <linearGradient id="colorCurrentYear" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
                            <stop offset="95%" stopColor="#b45309" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} opacity={0.5} />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                          allowDecimals={false}
                          tickFormatter={(v) => metricMode === 'volume' ? `${Math.round(v)}` : (v >= 1000 ? `R$${Math.round(v / 1000)}k` : `R$${v}`)}
                        />
                        <Tooltip
                          cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}
                          contentStyle={{
                            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                            color: isDarkMode ? '#f8fafc' : '#0f172a',
                            borderRadius: '16px',
                            border: isDarkMode ? '1px solid #1e293b' : 'none',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            padding: '12px'
                          }}
                          itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }}
                          formatter={(value: any) => [
                            metricMode === 'volume'
                              ? `${value} cirurgia${Number(value) !== 1 ? 's' : ''}`
                              : fmtMoney(Number(value) || 0),
                            metricMode === 'volume' ? 'Volume' : 'Faturamento'
                          ]}
                          labelStyle={{ fontWeight: 800, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '4px' }}
                        />
                        <Bar dataKey="value" fill="url(#colorRevenue)" radius={[8, 8, 0, 0]} barSize={40} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl shadow-slate-200/20 dark:shadow-none border border-white/20 dark:border-slate-800/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-10">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-6 bg-amber-500 rounded-full"></span> Mix de Cirurgias
                      </h3>
                      <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-lg tracking-widest font-black">
                        {categoryChartData.reduce((a, c) => a + c.value, 0)} TOTAL
                      </span>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl self-start sm:self-auto">
                      <button
                        onClick={() => setMixPeriod('month')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mixPeriod === 'month' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Mês
                      </button>
                      <button
                        onClick={() => setMixPeriod('year')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mixPeriod === 'year' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Ano
                      </button>
                      <button
                        onClick={() => setMixPeriod('total')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mixPeriod === 'total' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        Total
                      </button>
                    </div>
                  </div>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryChartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={10} dataKey="value">
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.name] || '#cbd5e1'} stroke="none" />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: isDarkMode ? '#0f172a' : '#ffffff', color: isDarkMode ? '#f8fafc' : '#0f172a', borderRadius: '16px', border: isDarkMode ? '1px solid #1e293b' : 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: isDarkMode ? '#f8fafc' : '#0f172a' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-10 space-y-3">
                    {categoryChartData.map(c => (
                      <div key={c.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center space-x-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[c.name] }}></div>
                          <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">{c.name}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* YoY Comparison */}
              <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl shadow-slate-200/20 dark:shadow-none border border-white/20 dark:border-slate-800/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-10 gap-4">
                  <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <span className="w-2 h-6 bg-amber-500 rounded-full"></span> Comparativo Anual
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {availableYears.map(y => {
                      const isSelected = selectedYearsYoy.includes(y);
                      const colorClass = y === '2023' ? 'bg-amber-400' : y === '2024' ? 'bg-primary' : y === '2025' ? 'bg-emerald-500' : 'bg-purple-500';
                      return (
                        <button
                          key={y}
                          onClick={() => {
                            setSelectedYearsYoy(prev =>
                              prev.includes(y)
                                ? prev.filter(year => year !== y)
                                : [...prev, y]
                            );
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isSelected
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm opacity-100'
                            : 'bg-transparent border-transparent opacity-40 grayscale hover:grayscale-0 hover:opacity-70'
                            }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`}></div>
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{y}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyComparisonData} margin={{ left: -20, right: 0 }}>
                      <defs>
                        <linearGradient id="colorYoy2023" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="colorYoy2024" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="colorYoy2025" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#059669" stopOpacity={0.9} />
                        </linearGradient>
                        <linearGradient id="colorYoy2026" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                          <stop offset="100%" stopColor="#7e22ce" stopOpacity={0.9} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#334155' : '#f1f5f9'} opacity={0.5} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                        tickFormatter={(v) => metricMode === 'revenue' ? (v >= 1000 ? `R$${v / 1000}k` : `R$${v}`) : `${v}`}
                      />
                      <Tooltip
                        cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc' }}
                        contentStyle={{
                          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
                          color: isDarkMode ? '#f8fafc' : '#0f172a',
                          borderRadius: '16px',
                          border: isDarkMode ? '1px solid #1e293b' : 'none',
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          padding: '12px'
                        }}
                        formatter={(value: any, name: any) => [
                          metricMode === 'revenue' ? fmtMoney(Number(value)) : `${value} cirurgia(s)`,
                          `Ano ${name}`
                        ]}
                        labelStyle={{ fontWeight: 800, color: isDarkMode ? '#94a3b8' : '#64748b', marginBottom: '4px' }}
                      />
                      {selectedYearsYoy.includes('2023') && (
                        <Bar dataKey="2023" name="2023" fill="url(#colorYoy2023)" radius={[6, 6, 0, 0]} barSize={12} />
                      )}
                      {selectedYearsYoy.includes('2024') && (
                        <Bar dataKey="2024" name="2024" fill="url(#colorYoy2024)" radius={[6, 6, 0, 0]} barSize={12} />
                      )}
                      {selectedYearsYoy.includes('2025') && (
                        <Bar dataKey="2025" name="2025" fill="url(#colorYoy2025)" radius={[6, 6, 0, 0]} barSize={12} />
                      )}
                      {selectedYearsYoy.includes('2026') && (
                        <Bar dataKey="2026" name="2026" fill="url(#colorYoy2026)" radius={[6, 6, 0, 0]} barSize={12} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'surgeries' && (
            /* Registros Tab */
            <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl sm:rounded-[3rem] shadow-2xl shadow-slate-200/20 dark:shadow-none border border-white/20 dark:border-slate-800/50 overflow-hidden animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="p-4 sm:p-8 border-b border-slate-100 dark:border-slate-800/50 flex flex-col gap-4 sm:gap-6 bg-slate-50/50 dark:bg-slate-800/40">
                <div className="flex-1 max-w-md relative">
                  <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar paciente, procedimento, médico ou hospital..."
                    className="w-full pl-11 pr-10 py-3 bg-white/70 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-primary focus:border-primary text-sm font-medium transition-all shadow-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                      title="Limpar busca"
                    >
                      <span className="material-icons text-base">close</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center bg-white dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    {/* Seletor de ANO */}
                    <select
                      value={filterYearSurgeries}
                      onChange={(e) => setFilterYearSurgeries(e.target.value)}
                      className="bg-transparent border-none rounded-xl text-xs font-black px-4 py-2 pr-10 appearance-none cursor-pointer uppercase tracking-widest text-slate-600 dark:text-slate-300"
                    >
                      {Array.from({ length: (new Date().getFullYear() - 2023) + 1 }, (_, i) => {
                        const y = (new Date().getFullYear() - i).toString();
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                    {/* Seletor de MÊS */}
                    <select
                      value={filterMonthSurgeries}
                      onChange={(e) => setFilterMonthSurgeries(e.target.value)}
                      className="bg-transparent border-none rounded-xl text-xs font-black px-4 py-2 pr-10 appearance-none cursor-pointer uppercase tracking-widest text-slate-600 dark:text-slate-300"
                    >
                      <option value="all">TODOS OS MESES</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={(i + 1).toString().padStart(2, '0')}>
                          {new Date(2000, i).toLocaleString('pt-BR', { month: 'long' }).toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-600 mx-1"></div>
                    <button onClick={handleExport} className="p-2.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-all" title="Exportar para Excel">
                      <span className="material-icons">download</span>
                    </button>
                  </div>
                  <input type="file" ref={fileInputRef} onChange={handleSpreadsheetImport} accept=".xlsx, .xls, .csv" className="hidden" />

                  {selectedIds.size > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-6 py-3.5 rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-red-500/20 transition-all animate-in zoom-in duration-300"
                    >
                      <span className="material-icons text-base">delete_forever</span>
                      Excluir {selectedIds.size}
                    </button>
                  )}

                  <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-md rounded-2xl items-center shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                    <button
                      onClick={handleDeleteDuplicates}
                      className="text-amber-600 hover:text-white border border-transparent hover:bg-amber-500 font-black text-[10px] tracking-widest uppercase px-4 py-3.5 rounded-l-2xl transition-all"
                      title="Excluir Duplicadas em Lote"
                    >
                      <span className="material-icons text-base">delete_sweep</span>
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-primary text-white px-6 py-3.5 rounded-r-2xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
                    >
                      Importar Planilha
                    </button>
                  </div>
                </div>
              </div>

              {/* Total Calculation Row */}
              <div className="px-8 py-4 bg-emerald-50 dark:bg-emerald-900/10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sm:hidden">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total da Lista</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{fmtMoney(currentListTotal)}</span>
              </div>
              {!isAssistant && (
                <div className="px-8 py-4 bg-emerald-50 dark:bg-emerald-900/10 border-b border-slate-100 dark:border-slate-800 hidden sm:flex justify-end items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Registros</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{filteredSurgeries.length}</p>
                  </div>
                  <div className="w-px h-8 bg-emerald-200 dark:bg-emerald-800/30"></div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">Total Estimado Mensal</p>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-300">{fmtMoney(currentListTotal)}</p>
                  </div>
                </div>
              )}

              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-xl sticky top-0 z-10 border-b border-white/20 dark:border-slate-700/50">
                    <tr className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-[0.2em]">
                      <th className="px-8 py-6 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={filteredSurgeries.length > 0 && selectedIds.size === filteredSurgeries.length}
                          onChange={() => toggleSelectAll(filteredSurgeries)}
                          className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary shadow-sm cursor-pointer"
                        />
                      </th>
                      <th className="px-8 py-6">Paciente / Hospital</th>
                      <th className="px-8 py-6">Procedimento Realizado</th>
                      <th className="px-8 py-6 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors group" onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}>
                        <div className="flex items-center gap-2">
                          Data
                          <span className={`material-icons text-base transition-transform duration-300 ${sortOrder === 'asc' ? 'rotate-180 text-primary' : 'text-slate-400 group-hover:text-primary'}`}>arrow_downward</span>
                        </div>
                      </th>
                      {!isAssistant && <th className="px-8 py-6">Valor</th>}
                      <th className="px-8 py-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredSurgeries.map(s => (
                      <tr key={s.id} onClick={() => setSelectedSurgery(s)} className={`cursor-pointer transition-all duration-300 group relative ${s.possivel_duplicata ? 'bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100/50 dark:hover:bg-amber-900/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:scale-[1.01] hover:shadow-lg hover:shadow-slate-200/40 dark:hover:shadow-none hover:z-10'} ${selectedIds.has(s.id) ? 'bg-primary/5 border-l-4 border-primary' : ''}`}>
                        <td className="px-8 py-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary shadow-sm cursor-pointer"
                          />
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <span className={`font-black text-sm uppercase tracking-tight group-hover:text-primary transition-colors ${s.possivel_duplicata ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{formatPatientName(s.paciente)}</span>
                            {s.possivel_duplicata && (
                              <span className="bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-0.5 whitespace-nowrap">
                                <span className="material-icons" style={{ fontSize: '10px' }}>warning</span> DUPLICATA?
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">{s.hospital}</div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-tight">{s.procedimento}</div>
                            {s.is_portfolio && (
                              <span title="No Portfólio" className="text-amber-500 flex-shrink-0">
                                <span className="material-icons text-sm">bookmark</span>
                              </span>
                            )}
                            {s.complexity_level && COMPLEXITY_CONFIG[s.complexity_level] && (
                              <span title={`Complexidade: ${COMPLEXITY_CONFIG[s.complexity_level].label}`} className="text-xs flex-shrink-0">
                                {COMPLEXITY_CONFIG[s.complexity_level].emoji}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <div className="text-[9px] px-2.5 py-1 rounded-lg inline-block font-black uppercase tracking-widest" style={{ backgroundColor: `${CATEGORY_COLORS[normalizeCategory(s.categoria)]}15`, color: CATEGORY_COLORS[normalizeCategory(s.categoria)] }}>
                              {normalizeCategory(s.categoria)}
                            </div>
                            {s.subtipo && (
                              <div className="text-[9px] px-2 py-0.5 rounded-lg inline-block font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {s.subtipo}
                              </div>
                            )}
                            {s.niveis_operados && (
                              <div className="text-[9px] px-2 py-0.5 rounded-lg inline-block font-bold bg-primary/10 text-primary dark:text-blue-300 border border-primary/20">
                                {s.niveis_operados}
                              </div>
                            )}
                            {s.medico && (
                              <div className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1">
                                <span className="material-icons text-[12px]">person</span>
                                {s.medico}
                              </div>
                            )}
                            {/* Indicadores de Foto */}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <span title={s.label_images && s.label_images.length > 0 ? `${s.label_images.length} etiqueta(s)` : 'Sem etiqueta'} className={`material-icons text-[14px] ${s.label_images && s.label_images.length > 0 ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                {s.label_images && s.label_images.length > 0 ? 'sell' : 'label_off'}
                              </span>
                              <span title={s.report_images && s.report_images.length > 0 ? `${s.report_images.length} relatório(s)` : 'Sem relatório'} className={`material-icons text-[14px] ${s.report_images && s.report_images.length > 0 ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}>
                                {s.report_images && s.report_images.length > 0 ? 'description' : 'post_add'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="text-sm font-bold text-slate-500 dark:text-slate-400">{formatDate(s.data)}</div>
                          {s.hora_inicio && s.hora_fim && (
                            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">
                              {s.hora_inicio} - {s.hora_fim}
                            </div>
                          )}
                        </td>
                        {!isAssistant && (
                          <td className="px-8 py-6">
                            <div className="text-primary dark:text-blue-400 font-black text-sm">{fmtMoney(s.valor_estimado)}</div>
                          </td>
                        )}
                        <td className="px-8 py-6 text-right space-x-1">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/edit/${s.id}`, { state: { filterYearSurgeries, filterMonthSurgeries } }); }} className="p-2.5 text-slate-300 hover:text-primary transition-colors rounded-xl hover:bg-primary/5">
                            <span className="material-icons text-xl">edit</span>
                          </button>
                          <button onClick={(e) => handleDeleteSurgery(e, s)} className="p-2.5 text-slate-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-950/20">
                            <span className="material-icons text-xl">delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredSurgeries.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-8 py-32 text-center">
                          <div className="flex flex-col items-center space-y-4">
                            <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300">
                              <span className="material-icons text-5xl">folder_off</span>
                            </div>
                            <p className="text-slate-400 font-bold text-lg tracking-tight">Nenhum registro encontrado para este período.</p>
                            <button onClick={() => navigate('/add', { state: { filterYearSurgeries, filterMonthSurgeries } })} className="text-primary font-black uppercase text-xs tracking-widest hover:underline">Adicionar Registro Manual</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSurgeries.map(s => (
                  <div key={s.id} onClick={() => setSelectedSurgery(s)} className={`p-4 cursor-pointer transition-all active:bg-slate-50 dark:active:bg-slate-800/50 ${s.possivel_duplicata ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''} ${selectedIds.has(s.id) ? 'bg-primary/5 border-l-4 border-primary' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(s.id)}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-5 h-5 rounded-lg border-slate-300 text-primary focus:ring-primary shadow-sm cursor-pointer mt-0.5 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-black text-sm uppercase tracking-tight ${s.possivel_duplicata ? 'text-amber-700 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>{formatPatientName(s.paciente)}</span>
                            {s.possivel_duplicata && (
                              <span className="bg-amber-500 text-white text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full">DUPLICATA?</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold truncate">{s.procedimento}</p>
                            {s.is_portfolio && (
                              <span title="No Portfólio" className="text-amber-500 flex-shrink-0">
                                <span className="material-icons text-xs">bookmark</span>
                              </span>
                            )}
                            {s.complexity_level && COMPLEXITY_CONFIG[s.complexity_level] && (
                              <span className="text-[10px] flex-shrink-0">
                                {COMPLEXITY_CONFIG[s.complexity_level].emoji}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <span className="text-[9px] px-2 py-0.5 rounded-md font-black uppercase" style={{ backgroundColor: `${CATEGORY_COLORS[normalizeCategory(s.categoria)]}15`, color: CATEGORY_COLORS[normalizeCategory(s.categoria)] }}>{normalizeCategory(s.categoria)}</span>
                            {s.subtipo && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{s.subtipo}</span>
                            )}
                            {s.niveis_operados && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-primary/10 text-primary dark:text-blue-300 border border-primary/20">{s.niveis_operados}</span>
                            )}
                            <span className="text-[10px] text-slate-400 font-bold">
                              {formatDate(s.data)}
                              {s.hora_inicio && s.hora_fim && (
                                <span className="ml-2 text-primary dark:text-blue-400 opacity-80 uppercase tracking-tighter font-black">
                                  • {s.hora_inicio}-{s.hora_fim}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {!isAssistant && <p className="text-primary dark:text-blue-400 font-black text-sm">{fmtMoney(s.valor_estimado)}</p>}
                        <p className="text-[10px] text-slate-400 font-bold mt-1">{s.hospital}</p>
                        {/* Indicadores de Foto - Mobile */}
                        <div className="flex items-center gap-1.5 justify-end mt-1.5">
                          <span className={`material-icons text-[13px] ${s.label_images && s.label_images.length > 0 ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}>
                            {s.label_images && s.label_images.length > 0 ? 'sell' : 'label_off'}
                          </span>
                          <span className={`material-icons text-[13px] ${s.report_images && s.report_images.length > 0 ? 'text-blue-500' : 'text-slate-300 dark:text-slate-600'}`}>
                            {s.report_images && s.report_images.length > 0 ? 'description' : 'post_add'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredSurgeries.length === 0 && (
                  <div className="p-12 text-center">
                    <span className="material-icons text-4xl text-slate-300">folder_off</span>
                    <p className="text-slate-400 font-bold mt-3">Nenhum registro encontrado.</p>
                    <button onClick={() => navigate('/add', { state: { filterYearSurgeries, filterMonthSurgeries } })} className="text-primary font-black uppercase text-xs tracking-widest hover:underline mt-2">Adicionar</button>
                  </div>
                )}
              </div>
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">

              {/* Doctor Summary Section (Assistant Only) */}
              {isAssistant && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Resumo por Médico</h3>
                      <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-1">Clique para ver os casos • Ano {filterYear}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {doctorSummaries.map(doc => (
                      <button
                        key={doc.name}
                        onClick={() => {
                          setSearchTerm(doc.name);
                          setFilterMonthSurgeries('all');
                          setFilterYearSurgeries(filterYear);
                          setActiveTab('surgeries');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2rem] border border-white/20 dark:border-slate-700/30 p-6 shadow-xl hover:border-primary hover:scale-[1.02] active:scale-[0.98] transition-all group text-left w-full"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-black text-slate-900 dark:text-white uppercase truncate flex-1 mr-2">{doc.name}</span>
                          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full text-[10px] font-black">{doc.total} CIR</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Cranio</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">{doc.cranio}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Coluna</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">{doc.coluna}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Periférico</p>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-300">{doc.nervo}</p>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mb-1">Média</p>
                            <p className="text-sm font-black text-primary">{doc.avgDuration}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rankings Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Surgeons */}
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/20 dark:border-slate-700/30 p-8 shadow-2xl overflow-hidden group hover:border-primary/30 transition-all duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary flex-shrink-0">
                        <span className="material-icons">person_star</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ranking Cirurgiões</h3>
                          <span className="text-[10px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {topSurgeons.length}
                          </span>
                        </div>
                        <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                          {rankingPeriod === 'month' ? 'Casos no mês atual' : rankingPeriod === 'year' ? `Casos no ano (${filterYear})` : 'Produtividade total por médico'}
                        </p>
                      </div>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex-shrink-0 self-start sm:self-auto">
                      <button
                        onClick={() => setRankingPeriod('month')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          rankingPeriod === 'month'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Mês
                      </button>
                      <button
                        onClick={() => setRankingPeriod('year')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          rankingPeriod === 'year'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Ano
                      </button>
                      <button
                        onClick={() => setRankingPeriod('total')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          rankingPeriod === 'total'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-primary'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Total
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-2">
                    {topSurgeons.map((surgeon, idx) => (
                      <button
                        key={surgeon.name}
                        onClick={() => handleFilterByDoctor(surgeon.name)}
                        className="w-full text-left group/item focus:outline-none block"
                        title={`Filtrar cirurgias do Dr(a). ${surgeon.name}`}
                      >
                        <div className="flex justify-between items-center mb-1.5 px-2">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase truncate pr-4 group-hover/item:text-primary transition-colors flex items-center gap-1.5">
                            <span>{idx + 1}. {surgeon.name}</span>
                            <span className="material-icons text-[14px] opacity-0 group-hover/item:opacity-100 text-primary transition-opacity">search</span>
                          </span>
                          <span className="text-xs font-black text-primary flex-shrink-0">{surgeon.count} <span className="text-[10px] text-slate-400 font-bold">CIR</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-cyan-400 rounded-full transition-all duration-1000 group-hover/item:brightness-110"
                            style={{ width: `${surgeon.percentage}%` }}
                          ></div>
                        </div>
                      </button>
                    ))}
                    {topSurgeons.length === 0 && (
                      <p className="text-slate-400 text-xs font-bold py-6 text-center">Nenhum caso registrado neste período.</p>
                    )}
                  </div>
                </div>

                {/* Top Hospitals */}
                <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/20 dark:border-slate-700/30 p-8 shadow-2xl overflow-hidden group hover:border-emerald-500/30 transition-all duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 flex-shrink-0">
                        <span className="material-icons">business</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Ranking Hospitais</h3>
                          <span className="text-[10px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {topHospitals.length}
                          </span>
                        </div>
                        <p className="text-slate-500 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                          {rankingPeriod === 'month' ? 'Casos no mês atual' : rankingPeriod === 'year' ? `Casos no ano (${filterYear})` : 'Volume total por instituição'}
                        </p>
                      </div>
                    </div>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl flex-shrink-0 self-start sm:self-auto">
                      <button
                        onClick={() => setRankingPeriod('month')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          rankingPeriod === 'month'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Mês
                      </button>
                      <button
                        onClick={() => setRankingPeriod('year')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          rankingPeriod === 'year'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Ano
                      </button>
                      <button
                        onClick={() => setRankingPeriod('total')}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          rankingPeriod === 'total'
                            ? 'bg-white dark:bg-slate-700 shadow-sm text-emerald-600'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Total
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-2">
                    {topHospitals.map((hospital, idx) => (
                      <button
                        key={hospital.name}
                        onClick={() => handleFilterByHospital(hospital.name)}
                        className="w-full text-left group/item focus:outline-none block"
                        title={`Filtrar cirurgias de ${hospital.name}`}
                      >
                        <div className="flex justify-between items-center mb-1.5 px-2">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase truncate pr-4 group-hover/item:text-emerald-500 transition-colors flex items-center gap-1.5">
                            <span>{idx + 1}. {hospital.name}</span>
                            <span className="material-icons text-[14px] opacity-0 group-hover/item:opacity-100 text-emerald-500 transition-opacity">search</span>
                          </span>
                          <span className="text-xs font-black text-emerald-500 flex-shrink-0">{hospital.count} <span className="text-[10px] text-slate-400 font-bold">CIR</span></span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-1000 group-hover/item:brightness-110"
                            style={{ width: `${hospital.percentage}%` }}
                          ></div>
                        </div>
                      </button>
                    ))}
                    {topHospitals.length === 0 && (
                      <p className="text-slate-400 text-xs font-bold py-6 text-center">Nenhum caso registrado neste período.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Annual Evolution Chart */}
              <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/20 dark:border-slate-700/30 p-8 shadow-2xl overflow-hidden group hover:border-primary/20 transition-all duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Evolução Anual</h3>
                    <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1">Comparativo de volume de casos por mês</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {availableYears.map(y => {
                      const isSelected = selectedYearsChart.includes(y);
                      const colorClass = y === '2023' ? 'bg-amber-400' : y === '2024' ? 'bg-primary' : y === '2025' ? 'bg-emerald-500' : 'bg-purple-500';
                      return (
                        <button
                          key={y}
                          onClick={() => {
                            setSelectedYearsChart(prev =>
                              prev.includes(y)
                                ? prev.filter(year => year !== y)
                                : [...prev, y]
                            );
                          }}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${isSelected
                            ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm opacity-100'
                            : 'bg-transparent border-transparent opacity-40 grayscale hover:grayscale-0 hover:opacity-70'
                            }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full ${colorClass}`}></div>
                          <span className="text-[10px] font-black text-slate-600 dark:text-slate-400">{y}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={Array.from({ length: 12 }, (_, i) => {
                      const month = i + 1;
                      const monthStr = month.toString().padStart(2, '0');
                      const monthName = new Date(2025, i).toLocaleString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
                      const row: any = { name: monthName };
                      availableYears.forEach(year => {
                        const filtered = mySurgeries.filter(s => s.data?.startsWith(`${year}-${monthStr}`));
                        row[year] = metricMode === 'revenue'
                          ? filtered.reduce((acc, s) => acc + s.valor_estimado, 0)
                          : filtered.length;
                      });
                      return row;
                    })}>
                      <defs>
                        <linearGradient id="color2023" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="color2024" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#135bec" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#135bec" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="color2025" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="color2026" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                        dy={16}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 800 }}
                        tickFormatter={(v) => metricMode === 'revenue' ? `R$${v > 1000 ? (v / 1000) + 'k' : v}` : v}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          border: 'none',
                          borderRadius: '16px',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                          padding: '12px'
                        }}
                        itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase' }}
                        labelStyle={{ color: '#94a3b8', fontSize: '10px', marginBottom: '8px', fontWeight: 800 }}
                        formatter={(v: number, name: string) => [metricMode === 'revenue' ? fmtMoney(v) : v, name]}
                      />
                      {selectedYearsChart.includes('2023') && (
                        <Area type="monotone" dataKey="2023" stroke="#fbbf24" strokeWidth={4} fillOpacity={1} fill="url(#color2023)" />
                      )}
                      {selectedYearsChart.includes('2024') && (
                        <Area type="monotone" dataKey="2024" stroke="#135bec" strokeWidth={4} fillOpacity={1} fill="url(#color2024)" />
                      )}
                      {selectedYearsChart.includes('2025') && (
                        <Area type="monotone" dataKey="2025" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#color2025)" />
                      )}
                      {selectedYearsChart.includes('2026') && (
                        <Area type="monotone" dataKey="2026" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#color2026)" />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Card Estimativa de Parafusos — Posicionado discretamente mais abaixo */}
              {screwStats.totalAll > 0 && (
                <div className="bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl rounded-2xl sm:rounded-[2.5rem] p-6 sm:p-8 shadow-xl shadow-slate-200/20 dark:shadow-none border border-slate-200/60 dark:border-slate-800/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                        <span className="material-icons text-xl">hardware</span>
                      </div>
                      <div>
                        <h4 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">Parafusos Estimados</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Monitorização de Artrodeses Toracolombares (exclui cervicais)</p>
                      </div>
                    </div>
                    <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl uppercase tracking-widest self-start sm:self-auto">
                      2 por nível instrumentado
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">{screwStats.totalMonth}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Este Mês</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                      <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter tabular-nums">{screwStats.totalYear}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ano {filterYear}</p>
                    </div>
                    <div className="bg-indigo-50/60 dark:bg-indigo-950/30 rounded-2xl p-4 border border-indigo-100 dark:border-indigo-900/40">
                      <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter tabular-nums">{screwStats.totalAll}</p>
                      <p className="text-[9px] font-bold text-indigo-500/80 dark:text-indigo-400/80 uppercase tracking-widest mt-1">Total Geral Acumulado</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Details Modal */}
        {
          selectedSurgery && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] overflow-hidden animate-in slide-in-from-bottom-10 duration-500 border border-white/40 dark:border-slate-700/50 flex flex-col">
                <div className="p-5 sm:p-10 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start gap-3 bg-slate-50/40 dark:bg-slate-800/40 flex-shrink-0">
                  <div className="min-w-0">
                    <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-white leading-tight uppercase tracking-tight truncate">{formatPatientName(selectedSurgery.paciente)}</h3>
                    <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1 sm:mt-2">
                      {formatDate(selectedSurgery.data)}
                      {selectedSurgery.hora_inicio && selectedSurgery.hora_fim && ` (${selectedSurgery.hora_inicio} - ${selectedSurgery.hora_fim})`}
                      • {selectedSurgery.hospital}
                    </p>
                  </div>
                  <button onClick={() => setSelectedSurgery(null)} className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 text-slate-400 shadow-sm border border-slate-100 dark:border-slate-700 flex-shrink-0">
                    <span className="material-icons">close</span>
                  </button>
                </div>
                <div className="p-5 sm:p-10 space-y-6 sm:space-y-8 overflow-y-auto flex-1">
                  {selectedSurgery.possivel_duplicata && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                      <span className="material-icons text-amber-500 text-2xl">warning</span>
                      <div className="flex-1">
                        <p className="font-black text-amber-800 dark:text-amber-300 text-sm uppercase tracking-wider">Possível Duplicata</p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs mt-1 font-medium">Este paciente já possui outra cirurgia registrada no mesmo mês.</p>
                      </div>
                      <button onClick={() => {
                        const updated = { ...selectedSurgery, possivel_duplicata: false };
                        saveSurgery(updated);
                        setSelectedSurgery(updated);
                        refreshData();
                      }} className="bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-[9px] font-black uppercase tracking-widest px-3 py-2 rounded-xl whitespace-nowrap hover:bg-amber-300 transition-colors">
                        Não é duplicata
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-10">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Procedimento</label>
                      <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg leading-tight">{selectedSurgery.procedimento}</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria / Subtipo</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg">{selectedSurgery.categoria}</p>
                        {selectedSurgery.subtipo && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {selectedSurgery.subtipo}
                          </span>
                        )}
                        {selectedSurgery.niveis_operados && (
                          <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary dark:text-blue-300 border border-primary/20">
                            Níveis: {selectedSurgery.niveis_operados}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Médico Responsável</label>
                      <p className="font-bold text-slate-800 dark:text-white text-base sm:text-lg uppercase">{selectedSurgery.medico}</p>
                    </div>
                    {!isAssistant && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faturamento Estimado</label>
                        <p className="font-black text-primary dark:text-blue-400 text-xl sm:text-2xl">{fmtMoney(selectedSurgery.valor_estimado)}</p>
                      </div>
                    )}
                  </div>

                  {/* Portfólio e Complexidade (se configurado) */}
                  {(selectedSurgery.is_portfolio || selectedSurgery.complexity_level || (selectedSurgery.portfolio_tags && selectedSurgery.portfolio_tags.length > 0) || selectedSurgery.portfolio_notes) && (
                    <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        {selectedSurgery.is_portfolio && (
                          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-amber-500 text-white shadow-sm">
                            <span className="material-icons text-xs">bookmark</span> Portfólio
                          </span>
                        )}
                        {selectedSurgery.complexity_level && COMPLEXITY_CONFIG[selectedSurgery.complexity_level] && (
                          <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            <span>{COMPLEXITY_CONFIG[selectedSurgery.complexity_level].emoji}</span>
                            <span>{COMPLEXITY_CONFIG[selectedSurgery.complexity_level].label}</span>
                          </span>
                        )}
                      </div>
                      {selectedSurgery.portfolio_tags && selectedSurgery.portfolio_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedSurgery.portfolio_tags.map(tag => (
                            <span key={tag} className="text-[10px] font-bold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary dark:text-blue-300">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {selectedSurgery.portfolio_notes && (
                        <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 p-4 rounded-2xl">
                          <label className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest block mb-1">Nota de Portfólio</label>
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{selectedSurgery.portfolio_notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedSurgery.observacoes && (
                    <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Relatório / Notas</label>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 sm:mt-3 leading-relaxed font-medium bg-slate-50 dark:bg-slate-800/40 p-4 sm:p-5 rounded-2xl whitespace-pre-wrap">{selectedSurgery.observacoes}</p>
                    </div>
                  )}
                  {selectedSurgery.label_images && selectedSurgery.label_images.length > 0 && (
                    <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 block">Etiqueta do Procedimento</label>
                      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {selectedSurgery.label_images.map((img, idx) => (
                          <div key={idx} className="flex-shrink-0 relative group">
                            <img
                              src={img}
                              alt={`Etiqueta ${idx + 1}`}
                              className="h-32 sm:h-48 w-auto rounded-xl sm:rounded-2xl object-cover shadow-lg border border-slate-200 dark:border-slate-700"
                            />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 bg-slate-900/40 backdrop-blur-sm rounded-xl sm:rounded-2xl transition-opacity">
                              <a href={img} target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors">
                                <span className="material-icons text-white text-lg">zoom_in</span>
                              </a>
                              <a href={img} download={`etiqueta_${selectedSurgery.id}_${idx + 1}.jpg`} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors" title="Baixar imagem">
                                <span className="material-icons text-white text-lg">download</span>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {selectedSurgery.report_images && selectedSurgery.report_images.length > 0 && (
                    <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-slate-800">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 sm:mb-4 block">Relatórios Anexados</label>
                      <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 custom-scrollbar">
                        {selectedSurgery.report_images.map((img, idx) => (
                          <div key={`report-${idx}`} className="flex-shrink-0 relative group">
                            <img
                              src={img}
                              alt={`Relatório ${idx + 1}`}
                              className="h-32 sm:h-48 w-auto rounded-xl sm:rounded-2xl object-cover shadow-lg border border-slate-200 dark:border-slate-700"
                            />
                            <div className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 bg-slate-900/40 backdrop-blur-sm rounded-xl sm:rounded-2xl transition-opacity">
                              <a href={img} target="_blank" rel="noopener noreferrer" className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors">
                                <span className="material-icons text-white text-lg">zoom_in</span>
                              </a>
                              <a href={img} download={`relatorio_${selectedSurgery.id}_${idx + 1}.jpg`} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/40 transition-colors" title="Baixar imagem">
                                <span className="material-icons text-white text-lg">download</span>
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-10 sm:pt-0 flex flex-col sm:flex-row sm:justify-end gap-3 sm:gap-4 flex-shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                  <button onClick={() => { setSelectedSurgery(null); navigate(`/edit/${selectedSurgery.id}`, { state: { filterYearSurgeries, filterMonthSurgeries } }); }} className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-primary text-white font-black rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.03] transition-all uppercase text-xs tracking-widest">Editar Registro</button>
                  <button onClick={() => setSelectedSurgery(null)} className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-black rounded-2xl uppercase text-xs tracking-widest">Fechar</button>
                </div>
              </div>
            </div>
          )}
        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
            <PortfolioTab mySurgeries={mySurgeries} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* Documents Tab */}
        {activeTab === 'documents' && (
          <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-500 mb-24 md:mb-0">
            <DocumentsTab isDarkMode={isDarkMode} />
          </div>
        )}

        {/* Users Tab (Admin Only) */}
        {activeTab === 'users' && isAdmin && (
          <div className="max-w-7xl mx-auto px-6 py-10 space-y-10 animate-in fade-in duration-500 mb-24 md:mb-0">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">Gestão de Usuários</h2>
                <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-2">Aprove, negue ou gerencie acessos da plataforma</p>
              </div>
            </div>

            <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] border border-white/20 dark:border-slate-700/30 overflow-hidden shadow-2xl">
              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700/50">
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status & Acesso</th>
                      <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/30">
                    {allUsers.map((u) => (
                      <tr key={u.email} className="group hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                              <img src={u.picture || `https://ui-avatars.com/api/?name=${u.name}&background=135bec&color=fff`} className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-black text-slate-900 dark:text-white uppercase text-sm tracking-tight">{u.name}</p>
                              <p className="text-[10px] text-slate-500 font-bold">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-2">
                            <span className={`w-fit px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : u.status === 'DENIED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                              {u.status === 'APPROVED' ? 'Aprovado' : u.status === 'DENIED' ? 'Negado' : 'Pendente'}
                            </span>
                            <select
                              className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 outline-none w-fit mt-1"
                              value={u.role || 'user'}
                              onChange={async (e) => {
                                await updateUserRole(u.email, e.target.value as 'user' | 'admin');
                                refreshData();
                              }}
                            >
                              <option value="user">Usuário Padrão</option>
                              <option value="admin">Administrador</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex items-center justify-end gap-2 outline-none">
                            <button
                              onClick={() => { setViewingEmail(u.email); setActiveTab('overview'); refreshData(); }}
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-primary hover:text-white transition-all shadow-sm"
                              title="Ver Dados"
                            >
                              <span className="material-icons text-sm">visibility</span>
                            </button>
                            {u.status !== 'APPROVED' && (
                              <button
                                onClick={async () => { await updateUserStatus(u.email, 'APPROVED'); refreshData(); }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                title="Aprovar"
                              >
                                <span className="material-icons text-sm">check</span>
                              </button>
                            )}
                            {u.status !== 'DENIED' && (
                              <button
                                onClick={async () => { await updateUserStatus(u.email, 'DENIED'); refreshData(); }}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                                title="Negar"
                              >
                                <span className="material-icons text-sm">block</span>
                              </button>
                            )}
                            <button
                              onClick={async () => { if (confirm(`Excluir usuário ${u.name}?`)) { await deleteUser(u.email); refreshData(); } }}
                              className="w-10 h-10 flex items-center justify-center rounded-xl bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                              title="Excluir"
                            >
                              <span className="material-icons text-sm">delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Cards */}
              <div className="md:hidden flex flex-col divide-y divide-slate-100 dark:divide-slate-700/50">
                {allUsers.map((u) => (
                  <div key={u.email} className="p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-700 shadow-sm">
                        <img src={u.picture || `https://ui-avatars.com/api/?name=${u.name}&background=135bec&color=fff`} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-black text-slate-900 dark:text-white uppercase text-sm tracking-tight truncate">{u.name}</p>
                        <p className="text-[10px] text-slate-500 font-bold truncate">{u.email}</p>
                      </div>
                      <div>
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : u.status === 'DENIED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {u.status === 'APPROVED' ? 'Aprovado' : u.status === 'DENIED' ? 'Negado' : 'Pendente'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 mt-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Acesso</label>
                      <select
                        className="bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 outline-none w-full appearance-none"
                        value={u.role || 'user'}
                        onChange={async (e) => {
                          await updateUserRole(u.email, e.target.value as 'user' | 'admin');
                          refreshData();
                        }}
                      >
                        <option value="user">Usuário Padrão</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-end gap-2 outline-none mt-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                      <button
                        onClick={() => { setViewingEmail(u.email); setActiveTab('overview'); refreshData(); }}
                        className="flex-1 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-primary hover:text-white transition-all shadow-sm"
                        title="Ver Dados"
                      >
                        <span className="material-icons text-sm">visibility</span>
                      </button>
                      {u.status !== 'APPROVED' && (
                        <button
                          onClick={async () => { await updateUserStatus(u.email, 'APPROVED'); refreshData(); }}
                          className="flex-1 h-10 flex items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                          title="Aprovar"
                        >
                          <span className="material-icons text-sm">check</span>
                        </button>
                      )}
                      {u.status !== 'DENIED' && (
                        <button
                          onClick={async () => { await updateUserStatus(u.email, 'DENIED'); refreshData(); }}
                          className="flex-1 h-10 flex items-center justify-center rounded-xl bg-amber-100 text-amber-600 hover:bg-amber-600 hover:text-white transition-all shadow-sm"
                          title="Negar"
                        >
                          <span className="material-icons text-sm">block</span>
                        </button>
                      )}
                      <button
                        onClick={async () => { if (confirm(`Excluir usuário ${u.name}?`)) { await deleteUser(u.email); refreshData(); } }}
                        className="flex-1 h-10 flex items-center justify-center rounded-xl bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                        title="Excluir"
                      >
                        <span className="material-icons text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
        }
      </div >
    </div >
  );
};

export default Dashboard;
