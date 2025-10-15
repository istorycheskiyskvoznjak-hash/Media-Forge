
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// FIX: Import ProcessItem from the shared types file.
import { Project, ChatMessage, ProcessItem } from '../types';
import * as geminiService from '../services/geminiService';
import * as supabaseService from '../services/supabaseService';
import Spinner from '../components/Spinner';

// --- ICONS ---
const SendIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
    </svg>
);
const PlusCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
);
const ArrowUpCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6-6m0 0 6 6m-6-6v12a6 6 0 0 1-12 0v-3" />
    </svg>
);
const ArrowPathIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.664 0M2.985 19.644a8.25 8.25 0 0 1 11.664 0m0 0a8.25 8.25 0 0 0 3.181-11.664m-14.845 0L7.488 9.348" />
    </svg>
);
const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
);


// --- AGENT INSTRUCTIONS ---
const ANGLE_INSTRUCTION = `«Точка зрения» — финальная инструкция v1.4 (консольный режим)

Роль: редактор-концептолог. Генерирует острые темы с неожиданным углом и рабочими хуками для роликов 12–18 минут. Делает «черновые дипы». Собирает ДОКУМЕНТ-пакет решения.

1) Цель
Выдать список тем с высоким потенциалом (spice_score ≥ 7) и подготовить по выбранной теме структурный «черновой дип» с мостами к современности и пакетной сборкой в ДОКУМЕНТ.

2) Язык и этика
Русский; стиль бодрый, плотный, хлёсткий.
Табу-темы допустимы (секс, наркотики, цензура, коррупция, рабство) без натуралистики и без романтизации насилия.

3) Двигатель остроты
Обязательные триггеры (все 4):
conflict столкновение интересов/интерпретаций
stake деньги/власть/жизни/репутация
mythflip переворот мифа (лаконично ломаем штамп)
bridge мост к сегодня (платформы, технологии, пропаганда, финансы)

Spice_score (0–10):
+2 табу-фактор • +2 цифры/метрики • +2 механизм «как работало» • +2 визуал (карта/артефакт/сценка) • +1 парадокс • +1 сворачиваемость в хук.
В список попадают только темы с spice_score ≥ 7.
Флаги самопроверки: conflict, stake, mythflip, bridge, metrics, mechanism, visuals.

4) Форматирование
Формат написания заголовка темы: **Тема:** **{название}**
`;

// FIX: Corrected typo in the instruction string.
const DEEP_RESEARCH_INSTRUCTION = `DEEP RESEARCH — Исследование для сценариев исторического сквозняка

Роль. Ты — Deep Research канала «Исторический Сквозняк». Работаешь дерзко, по-простому, без романтики и без инструкций к нарушениям. Берёшь ДОКУМЕНТ от бота "Точка зрения" и делаешь из него проверяемое, многоракурсное исследование с мостами в сегодняшний день.

Вход:
{/deep из процесса} (читать весь, извлекать данные/цитаты/даты/метрики).
Точка зрения: {{ANGLE}} (короткая формулировка угла/тезиса).
Допустимы глобальные источники (академия, первичка, серьёзные медиа, архивы, OSA/CEU и т.п.).

Жёсткие правила:
Стараться без домыслов и если есть возможность прикрепить факт, то нужно это делать.
На спорное — желательно два источника (академия/первичка + сильный обзор). Но не обязательно.
// FIX: Corrected typo in the instruction string.
// FIX: Corrected a typo in the instruction string. "то чтобы" changed to "чтобы".
Если не хватает источников — можешь себе позволить додумывать, чтобы только целая картинка оставалась логичной и не выбивалась из контекста: пометь строку в facts.csv как нужно доп.подтверждение.

Стиль: «пабный историк» — коротко, рублено, по делу. С эвфемизмами, но без операционки к нарушениям закона. Разговор на лавочке, пьяный дед рассказывает во дворе на скамейке историю для дворовых пацанов. Много слов-паразитов, много «умных слов», но общаться, как с тупым. Твоя задача — считать, что я тупой, и максимально просто донести сложную мысль всего нашего расследования. А я, как самый тупой, смогу сказать, поймут ли другие тупые наше видео.
`;

const SCRIPTER_INSTRUCTION = `Роль
Ты — «Скриптер», сценарист. Харизматичный и чуть циничный рассказчик в стиле «пабного историка». Твоя задача — превратить сухое исследование в короткие, ударные отрывки для озвучки и визуала. Главная оптика: деньги, власть/эго, PR и пропаганда. Разоблачай, удивляй, но не выдумывай.

Вход
Research — конспект исследования

Правила стиля
Разговорно, живо, без академической занудности.
Короткие фразы, ритм, паузы, интрига через троеточия.
Сленг и ирония уместны, но без мата и без пустой бравады.
// FIX: Corrected a typo in the instruction string.
// FIX: Corrected a typo in the instruction string.
В каждом отрывке есть хук, одна мысль/удар, микро-вывод.
В финале сценария — мостик в сегодня: «зачем знать сейчас».
// FIX: Corrected a typo in the instruction string based on the error. Although the line number was misleading, this appears to be the intended fix.
«пабный историк» — коротко, рублено, по делу. С эвфемизмами, но без инструкций к нарушению закона. Разговор на лавочке, пьяный дед рассказывает во дворе на скамейке историю для дворовых пацанов. Много слов-паразитов, много «умных слов», но общаться, как с тупым. Твоя задача — считать, что я максимально тупой, и максимально просто донести сложную мысль всего нашего расследования.
`;

const PROMPTER_INSTRUCTION = `Роль
Ты — Visual Bro канала «Исторический Сквозняк». По полученным документам делаешь визуал: мудборды, сториборд, референсы, промпты для генерации кадров 16:9 и 9:16, плюс краткие анимац-задачи для монтажа. Стиль: умный, лаконичный, исторически аккуратный, с китчем, кричащий, завлекающий, хлёсткий, ироничный, саркастичный, издевательский.

Вход
script из "процесса"

Правила
Старайся использовать какой-то текст на каждом кадре, чтобы было похоже на инфографику и постеры (!!!)
Не используй клише: кожаные текстуры, фейковые латиницы, «фэнтези»-шлемы и все в таком духе.
Допускается комбинировать: гравюра/архив/карта + кинематик (лёгкий параллакс, зерно).
// FIX: Corrected typo in the instruction string.
Обложка (thumb) — один крупный контрастный объект (один из персонажей сценария), читаемый заголовок, может быть подзаголовок
3 тест-варианта: «контраст лица», «предмет крупно», «сцена-символ».
Надписи на изображениях на русском языке, если это название типа apple, которое по русски никто не говорит, как яблоко, а говорят, как эйпл, то так и пиши на картинках "Эйпл", "Макдональдс", ...
`;

const META_INSTRUCTION = `Ты — Метакриейтор. Твоя задача — на основе готового сценария создать все метаданные для ролика. Это включает в себя: несколько вариантов цепляющих названий, оптимизированное под поиск описание, список релевантнх тегов и три идеи для обложки, которые привлекут внимание аудитории.`;
const SHORTER_INSTRUCTION = `Ты — Шортер. Твоя задача — взять длинный сценарий и гениально нарезать его на короткие, вирусные отрывки для Shorts, TikTok и Reels. Каждый шортс должен иметь четкую структуру: хук, развитие и вывод. Найди самые сочные моменты и преврати их в самостоятельные истории.`;


// --- TYPES & CONFIG ---
interface Command {
    name: string;
    subCommands?: string[];
    description: string;
}

interface Agent {
    id: string;
    name: string;
    description: string;
    systemInstruction: string;
    commands: Command[];
}

interface Scenario {
  id: string; // The UUID for the scenario
  title: string;
  sequence: number;
  items: ProcessItem[];
  isArchived: boolean;
}

const TYPE_ORDER: ProcessItem['type'][] = ['topic', 'deep_research', 'research', 'script', 'prompt'];

const agents: Agent[] = [
    { id: 'angle', name: 'Точка Зрения', description: 'Генерирует острые темы и хуки', systemInstruction: ANGLE_INSTRUCTION, commands: [
        { name: '/idea', description: 'Сгенерировать пул тем' },
        { name: '/deep', subCommands: ['/deep3', '/deep5'], description: 'Сделать черновой дип' },
    ]},
    { id: 'deep', name: 'Дип Рисёрчер', description: 'Проводит глубокое исследование', systemInstruction: DEEP_RESEARCH_INSTRUCTION, commands: [
        { name: '/go', description: 'Начать исследование по теме из процесса' }
    ]},
    { id: 'scripter', name: 'Скриптер', description: 'Пишет сценарий по исследованию', systemInstruction: SCRIPTER_INSTRUCTION, commands: [
        { name: '/eat', description: 'Собрать черновик' },
        { name: '/punch', description: 'Усилить хуки' },
        { name: '/clear_story', description: 'Сделать понятнее' },
    ]},
    { id: 'prompter', name: 'Промптер', description: 'Создает визуал и промпты', systemInstruction: PROMPTER_INSTRUCTION, commands: [
        { name: '/eat', description: 'Создать визуал по сценарию' },
        { name: '/export', description: 'Экспорт документа с промптами' },
    ]},
    { id: 'meta', name: 'Мета', description: 'Готовит метаданные для публикации', systemInstruction: META_INSTRUCTION, commands: [
         { name: '/generate', description: 'Создать название, описание и теги' }
    ]},
    { id: 'shorter', name: 'Шортер', description: 'Нарезает сценарий на шортсы', systemInstruction: SHORTER_INSTRUCTION, commands: [
         { name: '/cut', description: 'Нарезать на короткие ролики' }
    ]},
];


interface ScriptRoomPageProps {
  project: Project;
  onUpdateProject: (project: Project) => void;
}

const ScriptRoomPage: React.FC<ScriptRoomPageProps> = ({ project, onUpdateProject }) => {
    const [activeAgent, setActiveAgent] = useState<Agent>(agents[0]);
    const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
    
    const messagesEndRef = useRef<null | HTMLDivElement>(null);
    const prevIsLoadingRef = useRef<boolean>();
    const messageRefs = useRef<Map<number, HTMLDivElement | null>>(new Map());
    
    const currentMessages = chatHistories[activeAgent.id] || [];

    const { activeScenarios, archivedScenarios } = useMemo(() => {
        const active: Scenario[] = [];
        const archived: Scenario[] = [];
        scenarios.forEach(s => (s.isArchived ? archived.push(s) : active.push(s)));
        active.sort((a, b) => a.sequence - b.sequence);
        archived.sort((a, b) => b.sequence - a.sequence);
        return { activeScenarios: active, archivedScenarios: archived };
    }, [scenarios]);


    // --- DATA FETCHING & PERSISTENCE ---

    const fetchData = useCallback(async () => {
        setIsFetching(true);
        try {
            const [items, histories] = await Promise.all([
                supabaseService.getProcessItems(),
                supabaseService.getChatHistories(),
            ]);
            
            const scenarioMap = new Map<string, ProcessItem[]>();
            items.forEach(item => {
                if (item.scenarioId) {
                    if (!scenarioMap.has(item.scenarioId)) {
                        scenarioMap.set(item.scenarioId, []);
                    }
                    scenarioMap.get(item.scenarioId)!.push(item);
                }
            });

            const allScenarios: Scenario[] = [];
            let maxSequence = 0;

            scenarioMap.forEach((scenarioItems, scenarioId) => {
                const firstItem = scenarioItems[0];
                const title = firstItem.scenarioTitle || "Без названия";
                const isArchived = scenarioItems.every(i => i.is_archived);
                const sequenceMatch = title.match(/^(\d+)#/);
                const sequence = sequenceMatch ? parseInt(sequenceMatch[1], 10) : 0;
                if (sequence > maxSequence) maxSequence = sequence;
                
                scenarioItems.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));

                allScenarios.push({
                    id: scenarioId,
                    title,
                    sequence,
                    items: scenarioItems,
                    isArchived
                });
            });
            
            (window as any).__MAX_SCENARIO_SEQUENCE = maxSequence;

            setScenarios(allScenarios);
            
            if (Object.keys(histories).length > 0) {
                 setChatHistories(histories);
            }
        } catch (error) {
            console.error("Failed to load data from Supabase:", error);
            alert("Не удалось загрузить данные. Проверьте консоль для получения дополнительной информации.");
        } finally {
            setIsFetching(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const prevIsLoading = prevIsLoadingRef.current;
        if (prevIsLoading && !isLoading) { 
            const currentHistory = chatHistories[activeAgent.id];
            if (currentHistory && currentHistory.length > 0) {
                supabaseService.saveChatHistory(activeAgent.id, currentHistory)
                    .catch(e => console.error(`Failed to save history for ${activeAgent.id}`, e));
            }
        }
        prevIsLoadingRef.current = isLoading;
    }, [isLoading, activeAgent.id, chatHistories]);


    // --- UI & CHAT LOGIC ---

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [currentMessages]);
    
    useEffect(() => {
        setExpandedCommand(null);
    }, [activeAgent]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: input };
        const newHistory = [...currentMessages, userMessage];

        setChatHistories(prev => ({ ...prev, [activeAgent.id]: newHistory }));
        supabaseService.saveChatHistory(activeAgent.id, newHistory)
            .catch(e => console.error(`Failed to save user message for ${activeAgent.id}`, e));

        setInput('');
        setIsLoading(true);
        setExpandedCommand(null);

        setChatHistories(prev => ({ ...prev, [activeAgent.id]: [...(prev[activeAgent.id] || []), { role: 'model', text: '' }] }));

        try {
            await geminiService.streamChatResponse(
                newHistory,
                (chunk) => {
                    setChatHistories(prev => {
                        const histories = { ...prev };
                        const currentAgentHistory = [...histories[activeAgent.id]];
                        const lastMessage = currentAgentHistory[currentAgentHistory.length - 1];
                        if (lastMessage) {
                            lastMessage.text += chunk;
                        }
                        histories[activeAgent.id] = currentAgentHistory;
                        return histories;
                    });
                },
                activeAgent.systemInstruction
            );
        } catch (error) {
            console.error("Chat failed:", error);
            setChatHistories(prev => {
                 const histories = { ...prev };
                 const currentAgentHistory = [...histories[activeAgent.id]];
                 const lastMessage = currentAgentHistory[currentAgentHistory.length - 1];
                 const errorText = error instanceof Error ? error.message : String(error);
                 if(lastMessage) {
                    lastMessage.text = `Извините, произошла ошибка: ${errorText}`;
                 }
                 histories[activeAgent.id] = currentAgentHistory;
                 return histories;
            });
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    
    const handleCreateScenario = () => {
        const newTitle = window.prompt("Введите название нового сценария:");
        if (!newTitle || !newTitle.trim()) {
            return;
        }

        const nextSequence = ((window as any).__MAX_SCENARIO_SEQUENCE || 0) + 1;
        (window as any).__MAX_SCENARIO_SEQUENCE = nextSequence;

        const scenarioId = crypto.randomUUID();
        const scenarioTitle = `${String(nextSequence).padStart(3, '0')}#${newTitle.trim()}`;

        const newScenario: Scenario = {
            id: scenarioId,
            title: scenarioTitle,
            sequence: nextSequence,
            items: [],
            isArchived: false,
        };

        setScenarios(prev => [...prev, newScenario]);
        setActiveScenarioId(scenarioId);
    };

    const handleAddToProcess = async (content: string, titleOverride?: string, type: ProcessItem['type'] = 'deep_research'): Promise<ProcessItem | null> => {
        const activeScenario = scenarios.find(s => s.id === activeScenarioId);

        if (!activeScenario) {
            alert("Пожалуйста, сначала создайте или выберите сценарий.");
            return null;
        }
        
        const scenarioId = activeScenario.id;
        const scenarioTitle = activeScenario.title;
        const title = titleOverride || `Элемент ${type}`;
    
        try {
            const newItemData: Omit<ProcessItem, 'id' | 'is_archived'> = {
                title, content, sourceAgentId: activeAgent.id, type, scenarioId, scenarioTitle
            };
            const savedItem = await supabaseService.addProcessItem(newItemData);
            await fetchData(); // Refresh data to show the new item
            return savedItem;
        } catch (error) {
            console.error("Failed to add process item:", error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            alert(`Не удалось сохранить элемент процесса: ${errorMessage}`);
            return null;
        }
    };

    const handleDeleteProcessItem = async (itemId: string) => {
        const confirmed = window.confirm("Вы уверены, что хотите безвозвратно удалить этот элемент?");
        if (!confirmed) return;
        
        try {
            await supabaseService.deleteProcessItem(itemId);
            await fetchData();
        } catch(error) {
            console.error("Failed to delete process item:", error);
            alert("Не удалось удалить элемент процесса.");
        }
    };
    
    const handleProcessItemClick = (item: ProcessItem) => {
        setInput(item.content);
    }

    const handleCommandClick = (command: string) => {
        setInput(prev => {
            const trimmedPrev = prev.trim();
            if (trimmedPrev.length > 0) {
                return `${trimmedPrev} ${command} `;
            }
            return `${command} `;
        });
        setExpandedCommand(null);
    }

    const handleArchiveScenario = async (scenarioId: string) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;
    
        const confirmed = window.confirm(`Вы уверены, что хотите архивировать сценарий "${scenario.title}"?`);
        if (!confirmed) return;
    
        try {
            const itemIds = scenario.items.map(i => i.id);
            await supabaseService.updateProcessItemArchivedStatus(itemIds, true);
            await fetchData();
        } catch (error) {
            console.error("Failed to archive scenario:", error);
            alert("Не удалось архивировать сценарий.");
        }
    };
    
    const handleRestoreScenario = async (scenarioId: string) => {
        const scenario = scenarios.find(s => s.id === scenarioId);
        if (!scenario) return;
    
        try {
            const itemIds = scenario.items.map(i => i.id);
            await supabaseService.updateProcessItemArchivedStatus(itemIds, false);
            await fetchData();
        } catch (error) {
            console.error("Failed to restore scenario:", error);
            alert("Не удалось восстановить сценарий.");
        }
    };

    const extractTitleFromResearch = (text: string): string | null => {
        let match = text.match(/РЕШЕНИЯ:\s*«([^»]+)»/);
        if (match && match[1]) return match[1]?.trim();
    
        match = text.match(/\*\*Название ролика:\*\*\s*\*\*(.*?)\*\*/);
        if (match && match[1]) return match[1]?.trim();
        
        match = text.match(/^##\s*(.*)/m);
        if (match && match[1]) return match[1].replace(/«|»/g, '')?.trim();
    
        return null;
    }

    const renderAgentResponse = (msg: ChatMessage, index: number) => {
        const prevMessage = currentMessages[index - 1];
        const isLastMessage = index === currentMessages.length - 1;
        
        let content: React.ReactNode;
        let isPrompterFinalResponse = false;
        const activeScenario = scenarios.find(s => s.id === activeScenarioId);

        // --- Response for 'Точка Зрения' ---
        if (activeAgent.id === 'angle') {
            const isIdeaResponse = prevMessage?.role === 'user' && prevMessage.text.trim().startsWith('/idea');
            const isDeepResponse = prevMessage?.role === 'user' && prevMessage.text.trim().includes('/deep');

            if (isIdeaResponse) {
                const lines = msg.text.split('\n');
                content = (
                    <div>
                        {lines.map((line, idx) => {
                            const topicRegex = /(?:\d+\.\s*)?\*\*Тема:\s*(.*?)\*\*/i;
                            const match = line.match(topicRegex);
                            let title = '';
            
                            if (match && match[1]) {
                                title = match[1].trim();
                            }
                            
                            if (title) {
                                return (
                                    <div key={idx} className="flex items-center justify-between group p-1 -m-1 rounded hover:bg-gray-700/50">
                                        <p className="flex-1 whitespace-pre-wrap break-words">{line}</p>
                                        <button 
                                            onClick={() => handleAddToProcess(title, title, 'topic')} 
                                            disabled={!activeScenarioId}
                                            className="ml-4 px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:bg-gray-600 disabled:cursor-not-allowed"
                                            title={activeScenarioId ? `Добавить тему "${title}" в процесс` : "Сначала выберите сценарий"}
                                        >
                                            Добавить
                                        </button>
                                    </div>
                                );
                            } else {
                                return <p key={idx} className="whitespace-pre-wrap break-words">{line || '\u00A0'}</p>;
                            }
                        })}
                    </div>
                );
            } else if (isDeepResponse && !isLoading) {
                 let suggestedTitle = extractTitleFromResearch(msg.text);
                 if (!suggestedTitle) {
                     const userPromptText = prevMessage?.text?.replace(/\/deep[35]?/, '').trim();
                     if (userPromptText && userPromptText.length > 0) {
                         suggestedTitle = `Deep Dive: ${userPromptText.substring(0, 50)}`;
                     } else {
                         suggestedTitle = 'Новый глубокий анализ';
                     }
                 }
                 content = (
                    <div>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="text-right mt-2">
                            <button 
                                onClick={() => handleAddToProcess(msg.text, suggestedTitle, 'deep_research')} 
                                disabled={!activeScenarioId}
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                title={activeScenarioId ? "Добавить в активный сценарий" : "Сначала выберите сценарий"}
                            >
                                + Добавить
                            </button>
                        </div>
                    </div>
                );
            }
        }

        // --- Response for 'Дип Рисёрчер' ---
        if (!content && activeAgent.id === 'deep') {
            const isGoResponse = prevMessage?.role === 'user' && prevMessage.text.trim().includes('/go');
            if (isGoResponse && !isLoading) {
                const title = extractTitleFromResearch(msg.text) || `Исследование по: ${prevMessage.text.replace('/go', '').trim().substring(0, 30)}...`;
                content = (
                    <div>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="text-right mt-2">
                            <button 
                                onClick={() => handleAddToProcess(msg.text, title, 'research')} 
                                disabled={!activeScenarioId}
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                title={activeScenarioId ? "Добавить в активный сценарий" : "Сначала выберите сценарий"}
                            >
                                + Добавить
                            </button>
                        </div>
                    </div>
                );
            }
        }

        // --- Response for 'Скриптер' ---
        if (!content && activeAgent.id === 'scripter') {
            const isScripterResponse = prevMessage?.role === 'user' && (prevMessage.text.trim().includes('/eat') || prevMessage.text.trim().includes('/punch') || prevMessage.text.trim().includes('/clear_story'));
            if (isScripterResponse && !isLoading) {
                const title = `Сценарий по: ${prevMessage.text.replace(/\/(eat|punch|clear_story)/, '').trim().substring(0, 30)}...`;
                content = (
                    <div>
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        <div className="text-right mt-2">
                            <button 
                                onClick={() => handleAddToProcess(msg.text, title, 'script')} 
                                disabled={!activeScenarioId}
                                className="px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-md text-xs font-medium transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                                title={activeScenarioId ? "Добавить в активный сценарий" : "Сначала выберите сценарий"}
                            >
                                + Добавить в процесс
                            </button>
                        </div>
                    </div>
                );
            }
        }
        
        // --- Response for 'Промптер' ---
        if (activeAgent.id === 'prompter' && !isLoading && isLastMessage) {
             const isPrompterCommand = prevMessage?.role === 'user' && (prevMessage.text.includes('/eat') || prevMessage.text.includes('/export'));
             if (isPrompterCommand) {
                isPrompterFinalResponse = true;
             }
        }
        
        // Default: just render the text
        if (!content) {
            content = <p className="whitespace-pre-wrap break-words">{msg.text || '\u00A0'}</p>;
        }

        return (
            <div
                key={index}
                ref={(el) => { messageRefs.current.set(index, el); }}
                className="flex gap-3 text-sm"
            >
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 font-bold">
                    {msg.role === 'user' ? 'U' : 'A'}
                </div>
                <div className={`flex-1 p-3 rounded-lg ${msg.role === 'user' ? 'bg-gray-700/80' : 'bg-gray-600/50'}`}>
                    {content}
                    {isLoading && isLastMessage && <Spinner size="h-4 w-4 mt-2" />}
                    {isPrompterFinalResponse && (
                        <div className="text-right mt-3">
                            <button
                                onClick={() => activeScenario && handleAddToProcess(msg.text, `Визуал для: ${activeScenario.title}`, 'prompt')}
                                disabled={!activeScenario}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-bold text-white transition-colors shadow-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
                            >
                                Добавить визуал и завершить
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };


    return (
        <div className="flex h-[calc(100vh-140px)] gap-4">

            {/* Process Panel (Left) */}
            <div className="w-1/4 bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h2 className="text-xl font-semibold text-purple-300">Процесс</h2>
                    <button onClick={handleCreateScenario} title="Создать новый сценарий" className="p-1 text-gray-300 hover:text-purple-400">
                        <PlusCircleIcon className="w-7 h-7" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-4">
                   {isFetching ? (
                        <div className="flex justify-center pt-8"><Spinner /></div>
                   ) : (
                        <>
                            <div>
                                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Активные сценарии</h3>
                                <div className="space-y-2">
                                    {activeScenarios.length === 0 && <p className="text-gray-500 text-sm text-center pt-2">Нет активных сценариев.</p>}
                                    {activeScenarios.map(scenario => (
                                        <details key={scenario.id} open className={`p-2 bg-gray-900/50 rounded-md group transition-all ${scenario.id === activeScenarioId ? 'border-2 border-purple-500' : 'border-2 border-transparent'}`}>
                                            <summary className="font-semibold text-gray-200 cursor-pointer select-none flex justify-between items-center" onClick={(e) => { e.preventDefault(); setActiveScenarioId(scenario.id); }}>
                                                <span>{scenario.title}</span>
                                                {scenario.items.length >= 4 && (
                                                    <button onClick={(e) => { e.stopPropagation(); handleArchiveScenario(scenario.id); }} title="Завершить и архивировать" className="p-1 text-gray-400 hover:text-green-400">
                                                        <CheckCircleIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </summary>
                                            <div className="mt-2 pl-3 border-l-2 border-gray-600 space-y-1">
                                                {scenario.items.map(item => (
                                                    <div key={item.id} className="p-1.5 bg-gray-700/30 rounded-md relative group/item">
                                                        <p className="text-xs font-bold text-purple-400">{item.type.replace('_', ' ')}</p>
                                                        <p className="text-sm font-medium text-gray-200 truncate cursor-pointer" title={item.title} onClick={() => handleProcessItemClick(item)}>{item.title}</p>
                                                        <button onClick={() => handleDeleteProcessItem(item.id)} className="absolute top-1 right-1 p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                            <XCircleIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                           
                             {archivedScenarios.length > 0 && (
                                <details className="pt-2" open>
                                    <summary className="text-sm font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none">Архив ({archivedScenarios.length})</summary>
                                    <div className="space-y-3 mt-2">
                                        {archivedScenarios.map(scenario => (
                                            <details key={scenario.id} className="p-2 bg-gray-900/30 rounded-md">
                                                <summary className="font-semibold text-gray-300 text-sm cursor-pointer select-none flex justify-between items-center">
                                                    <span>{scenario.title}</span>
                                                    <button onClick={() => handleRestoreScenario(scenario.id)} title="Восстановить сценарий" className="p-1 text-gray-400 hover:text-green-400">
                                                        <ArrowPathIcon className="w-5 h-5" />
                                                    </button>
                                                </summary>
                                                <div className="mt-2 pl-3 border-l-2 border-gray-600 space-y-1">
                                                    {scenario.items.map(item => (
                                                         <div key={item.id} className="p-1.5 bg-gray-700/30 rounded-md group/item relative">
                                                            <p className="text-xs font-bold text-gray-400">-- {item.type.replace('_', ' ')}</p>
                                                            <p className="text-sm font-medium text-gray-400 truncate" title={item.title}>{item.title}</p>
                                                            <div className="absolute top-1 right-1 flex opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                <button onClick={() => handleDeleteProcessItem(item.id)} title="Удалить навсегда" className="p-1 text-gray-500 hover:text-red-400">
                                                                    <TrashIcon className="w-5 h-5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </>
                   )}
                </div>
            </div>

            {/* Main Content Area (Right) */}
            <div className="w-3/4 flex flex-col gap-4">
                {/* Agent Bar (Top) */}
                <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 p-4">
                    <h2 className="text-xl font-semibold text-purple-300 mb-3">Агенты</h2>
                    <div className="flex flex-wrap gap-2">
                        {agents.map(agent => (
                            <button
                                key={agent.id}
                                onClick={() => setActiveAgent(agent)}
                                title={agent.description}
                                className={`px-4 py-2 rounded-lg cursor-pointer transition-colors text-left ${activeAgent.id === agent.id ? 'bg-purple-900/70 shadow-lg' : 'bg-gray-900/50 hover:bg-gray-700/50'}`}
                            >
                                <p className="font-bold text-sm text-gray-200">{agent.name}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chat Panel (Bottom) */}
                <div className="flex-1 bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col relative overflow-hidden">
                    {isFetching ? (
                        <div className="flex-1 flex items-center justify-center"><Spinner /></div>
                    ) : (
                        <>
                            {/* Chat Messages */}
                            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                            {currentMessages.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-center text-gray-500">
                                    <div>
                                        <p className="text-lg font-semibold">{activeAgent.name}</p>
                                        <p>История чата пуста. Начните диалог.</p>
                                    </div>
                                </div>
                            ) : (
                                currentMessages.map(renderAgentResponse)
                            )}
                            <div ref={messagesEndRef} />
                            </div>
                            
                            {/* Input Area */}
                            <div className="p-4 border-t border-gray-700/60 bg-gray-800 relative">
                                {/* Command Suggestions */}
                                {expandedCommand && (
                                    <div className="absolute bottom-full left-4 mb-2 p-2 bg-gray-900 rounded-md shadow-lg border border-gray-600 w-auto">
                                        <div className="flex gap-2">
                                        {activeAgent.commands.find(c => c.name === expandedCommand)?.subCommands?.map(subCmd => (
                                            <button key={subCmd} onClick={() => handleCommandClick(subCmd)} className="px-3 py-1 bg-gray-700 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors">
                                                {subCmd}
                                            </button>
                                        ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    {/* Command Buttons */}
                                    <div className="flex gap-1">
                                    {activeAgent.commands.map(cmd => (
                                        cmd.subCommands ? (
                                            <button key={cmd.name} onClick={() => setExpandedCommand(expandedCommand === cmd.name ? null : cmd.name)} className="p-2 bg-gray-700 hover:bg-purple-700 rounded-full text-gray-300 transition-colors">
                                                <ArrowUpCircleIcon className="w-6 h-6" />
                                            </button>
                                        ) : (
                                            <button key={cmd.name} title={cmd.description} onClick={() => handleCommandClick(cmd.name)} className="px-3 py-2 bg-gray-700 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors">
                                                {cmd.name}
                                            </button>
                                        )
                                    ))}
                                    </div>
                                    
                                    {/* Text Input */}
                                    <textarea
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={handleKeyPress}
                                        placeholder={`Сообщение для ${activeAgent.name}...`}
                                        rows={1}
                                        className="flex-1 p-2 bg-gray-900/50 rounded-md border border-gray-600 focus:ring-2 focus:ring-purple-500 resize-none"
                                    />

                                    {/* Send Button */}
                                    <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-3 bg-purple-600 hover:bg-purple-700 rounded-full text-white transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
                                        <SendIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScriptRoomPage;
