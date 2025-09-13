class GramJYOTIDashboard {
    constructor() {
        this.channelId = '3072359';
        this.readAPIKey = '5U4LUIC6VHGRKS2B';
        this.updateInterval = 15000;
        this.charts = {};
        this.historyCharts = {};
        this.historicalData = [];
        this.maxDataPoints = 100;
        this.alertHistory = this.loadAlertHistory();

        this.initCharts();
        this.loadHistoricalData();
        this.startDataPolling();
        this.renderAlertHistory();
        this.fetchHistoryData();
    }

    initCharts() {
        this.charts.solar = echarts.init(document.getElementById('solar-chart'));
        this.charts.battery = echarts.init(document.getElementById('battery-chart'));
        this.charts.efficiency = echarts.init(document.getElementById('efficiency-chart'));
        this.charts.temperature = echarts.init(document.getElementById('temp-chart'));

        this.historyCharts.solar = echarts.init(document.getElementById('solar-history-chart'));
        this.historyCharts.battery = echarts.init(document.getElementById('battery-history-chart'));
        this.historyCharts.efficiency = echarts.init(document.getElementById('efficiency-history-chart'));
        this.historyCharts.temperature = echarts.init(document.getElementById('temp-history-chart'));

        const commonChartOption = {
            grid: { top: 10, right: 10, bottom: 20, left: 40 },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'time', axisLabel: { color: '#2c3e50' } },
            yAxis: { type: 'value', axisLabel: { color: '#2c3e50' } },
            series: [{ type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 3 } }]
        };

        this.charts.solar.setOption({
            ...commonChartOption,
            title: { text: 'Power Trend', left: 'center', textStyle: { fontSize: 15, color: '#3498db' } },
            series: [{ data: [], name: 'Solar Power', color: '#3498db' }]
        });

        this.charts.battery.setOption({
            ...commonChartOption,
            title: { text: 'SOC Trend', left: 'center', textStyle: { fontSize: 15, color: '#27ae60' } },
            series: [{ data: [], name: 'State of Charge', color: '#27ae60' }]
        });

        this.charts.efficiency.setOption({
            ...commonChartOption,
            title: { text: 'Efficiency', left: 'center', textStyle: { fontSize: 15, color: '#f39c12' } },
            series: [{ data: [], name: 'Efficiency %', color: '#f39c12' }]
        });

        this.charts.temperature.setOption({
            ...commonChartOption,
            title: { text: 'Temperature', left: 'center', textStyle: { fontSize: 15, color: '#e74c3c' } },
            series: [{ data: [], name: 'Battery Temp', color: '#e74c3c' }]
        });

        // History charts
        const historyOption = {
            grid: { top: 10, right: 10, bottom: 20, left: 40 },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'time', axisLabel: { color: '#2c3e50' } },
            yAxis: { type: 'value', axisLabel: { color: '#2c3e50' } },
            series: [{ type: 'line', showSymbol: false, smooth: true, lineStyle: { width: 2 } }]
        };

        this.historyCharts.solar.setOption({ ...historyOption, title: { text: 'Solar Power (W)', left: 'center', textStyle: { fontSize: 13, color: '#3498db' } }, series: [{ data: [], name: 'Solar Power', color: '#3498db' }] });
        this.historyCharts.battery.setOption({ ...historyOption, title: { text: 'Battery SOC (%)', left: 'center', textStyle: { fontSize: 13, color: '#27ae60' } }, series: [{ data: [], name: 'SOC', color: '#27ae60' }] });
        this.historyCharts.efficiency.setOption({ ...historyOption, title: { text: 'Efficiency (%)', left: 'center', textStyle: { fontSize: 13, color: '#f39c12' } }, series: [{ data: [], name: 'Efficiency', color: '#f39c12' }] });
        this.historyCharts.temperature.setOption({ ...historyOption, title: { text: 'Battery Temp (°C)', left: 'center', textStyle: { fontSize: 13, color: '#e74c3c' } }, series: [{ data: [], name: 'Battery Temp', color: '#e74c3c' }] });

        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => chart.resize());
            Object.values(this.historyCharts).forEach(chart => chart.resize());
        });
    }

    async fetchData() {
        try {
            this.showLoading(true);
            const url = `https://api.thingspeak.com/channels/${this.channelId}/feeds.json?api_key=${this.readAPIKey}&results=10`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            this.showLoading(false);
            return this.processData(data);
        } catch (error) {
            this.showLoading(false);
            this.showError('Failed to fetch data. Using offline cache.');
            return this.getCachedData();
        }
    }

    async fetchHistoryData() {
        try {
            const url = `https://api.thingspeak.com/channels/${this.channelId}/feeds.json?api_key=${this.readAPIKey}&results=2880`; // 48 hours at 1 min interval
            const response = await fetch(url);
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            this.renderHistoryCharts(data.feeds || []);
        } catch (error) {
            this.renderHistoryCharts([]);
        }
    }

    renderHistoryCharts(feeds) {
        // Solar Power
        const solarData = feeds.map(f => [new Date(f.created_at).getTime(), parseFloat(f.field7) || 0]);
        this.historyCharts.solar.setOption({ series: [{ data: solarData }] });

        // Battery SOC
        const socData = feeds.map(f => [new Date(f.created_at).getTime(), parseFloat(f.field6) || 0]);
        this.historyCharts.battery.setOption({ series: [{ data: socData }] });

        // Efficiency
        const effData = feeds.map(f => {
            const solar = parseFloat(f.field7) || 0;
            const load = parseFloat(f.field8) || 0;
            return [new Date(f.created_at).getTime(), solar > 0 ? (load / solar) * 100 : 0];
        });
        this.historyCharts.efficiency.setOption({ series: [{ data: effData }] });

        // Battery Temp
        const tempData = feeds.map(f => [new Date(f.created_at).getTime(), parseFloat(f.field5) || 0]);
        this.historyCharts.temperature.setOption({ series: [{ data: tempData }] });
    }

    processData(data) {
        if (!data.feeds || data.feeds.length === 0) throw new Error('No data available');
        const latestFeed = data.feeds[data.feeds.length - 1];
        const processedData = {
            timestamp: new Date(latestFeed.created_at),
            solar_voltage: parseFloat(latestFeed.field1) || 0,
            solar_current: parseFloat(latestFeed.field2) || 0,
            battery_voltage: parseFloat(latestFeed.field3) || 0,
            battery_current: parseFloat(latestFeed.field4) || 0,
            battery_temp: parseFloat(latestFeed.field5) || 0,
            soc: parseFloat(latestFeed.field6) || 0,
            solar_power: parseFloat(latestFeed.field7) || 0,
            load_power: parseFloat(latestFeed.field8) || 0,
            ambient_light: parseFloat(latestFeed.field9) || 0
        };
        processedData.efficiency = processedData.solar_power > 0 ? 
            (processedData.load_power / processedData.solar_power) * 100 : 0;
        processedData.daily_energy = this.calculateDailyEnergy(data.feeds);
        return processedData;
    }

    calculateDailyEnergy(feeds) {
        const powers = feeds.map(f => parseFloat(f.field7) || 0);
        const energyWh = powers.reduce((sum, p) => sum + p * (this.updateInterval / 3600000), 0);
        return (energyWh / 1000).toFixed(2);
    }

    updateDashboard(data) {
        document.getElementById('solar-power').textContent = data.solar_power.toFixed(1);
        document.getElementById('solar-voltage').textContent = data.solar_voltage.toFixed(1);
        document.getElementById('solar-current').textContent = data.solar_current.toFixed(2);

        document.getElementById('battery-soc').textContent = data.soc.toFixed(0);
        document.getElementById('battery-voltage').textContent = data.battery_voltage.toFixed(1);
        document.getElementById('battery-current').textContent = data.battery_current.toFixed(2);
        document.getElementById('battery-temp').textContent = data.battery_temp.toFixed(1);

        document.getElementById('system-efficiency').textContent = data.efficiency.toFixed(1);
        document.getElementById('daily-energy').textContent = data.daily_energy;
        document.getElementById('light-intensity').textContent = data.ambient_light.toFixed(0);
        document.getElementById('last-update').textContent = data.timestamp.toLocaleTimeString();

        this.updateCharts(data);
        this.checkAlerts(data);
        this.storeData(data);
    }

    updateCharts(data) {
        const timestamp = data.timestamp.getTime();
        this.updateChart('solar', timestamp, data.solar_power);
        this.updateChart('battery', timestamp, data.soc);
        this.updateChart('efficiency', timestamp, data.efficiency);
        this.updateChart('temperature', timestamp, data.battery_temp);
    }

    updateChart(chartName, timestamp, value) {
        const chart = this.charts[chartName];
        const option = chart.getOption();
        const seriesData = option.series[0].data || [];
        seriesData.push([timestamp, value]);
        if (seriesData.length > this.maxDataPoints) seriesData.shift();
        option.series[0].data = seriesData;
        chart.setOption(option, { notMerge: true, lazyUpdate: true });
    }

    checkAlerts(data) {
        const alertContainer = document.getElementById('alert-container');
        alertContainer.innerHTML = '';
        const alerts = [];
        if (data.battery_temp > 45) alerts.push('⚠️ CRITICAL: Battery temperature too high (>45°C)');
        if (data.battery_voltage > 14.5) alerts.push('⚠️ WARNING: Overvoltage detected (>14.5V)');
        if (data.battery_voltage < 11.5) alerts.push('⚠️ WARNING: Undervoltage detected (<11.5V)');
        if (data.soc < 20) alerts.push('⚠️ WARNING: Low battery (<20%)');
        if (alerts.length > 0) {
            alertContainer.innerHTML = alerts.map(alert => `<div class="alert-box" role="alert">${alert}</div>`).join('');
            document.getElementById('system-status').className = 'status-badge status-danger';
            document.getElementById('system-status').textContent = 'ALERT';
            this.playAlertSound();
            alerts.forEach(alert => this.addAlertHistory(alert, data.timestamp));
        } else {
            document.getElementById('system-status').className = 'status-badge status-normal';
            document.getElementById('system-status').textContent = 'NORMAL';
        }
        this.renderAlertHistory();
    }

    addAlertHistory(alert, timestamp) {
        this.alertHistory.push({ message: alert, time: timestamp });
        if (this.alertHistory.length > 50) this.alertHistory.shift();
        localStorage.setItem('gramjyoti_alerts', JSON.stringify(this.alertHistory));
    }

    loadAlertHistory() {
        try {
            const stored = localStorage.getItem('gramjyoti_alerts');
            if (stored) return JSON.parse(stored);
        } catch (e) {}
        return [];
    }

    renderAlertHistory() {
        const container = document.getElementById('alert-history');
        if (!container) return;
        if (this.alertHistory.length === 0) {
            container.innerHTML = '<div style="color:#666;">No past alerts.</div>';
            return;
        }
        container.innerHTML = this.alertHistory.slice().reverse().map(a =>
            `<div class="alert-entry"><span class="alert-msg">${a.message}</span><span class="alert-time">(${new Date(a.time).toLocaleString()})</span></div>`
        ).join('');
    }

    playAlertSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDci0FLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGnN/0xIIwChhVrefusF0WED2Q2fTDfzMMHEyo5O2zYxwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bN2zA=');
        audio.play().catch(e => {});
    }

    storeData(data) {
        this.historicalData.push(data);
        if (this.historicalData.length > 100) this.historicalData.shift();
        localStorage.setItem('gramjyoti_data', JSON.stringify(this.historicalData));
    }

    loadHistoricalData() {
        try {
            const stored = localStorage.getItem('gramjyoti_data');
            if (stored) {
                this.historicalData = JSON.parse(stored);
                this.historicalData.forEach(data => {
                    const timestamp = new Date(data.timestamp).getTime();
                    this.updateChart('solar', timestamp, data.solar_power);
                    this.updateChart('battery', timestamp, data.soc);
                    this.updateChart('efficiency', timestamp, data.efficiency);
                    this.updateChart('temperature', timestamp, data.battery_temp);
                });
            }
        } catch (e) {
            console.error('Error loading historical data:', e);
        }
    }

    getCachedData() {
        if (this.historicalData.length > 0) {
            return this.historicalData[this.historicalData.length - 1];
        }
        return {
            timestamp: new Date(),
            solar_voltage: 0,
            solar_current: 0,
            battery_voltage: 0,
            battery_current: 0,
            battery_temp: 0,
            soc: 0,
            solar_power: 0,
            load_power: 0,
            ambient_light: 0,
            efficiency: 0,
            daily_energy: 0
        };
    }

    showError(message) {
        const alertContainer = document.getElementById('alert-container');
        alertContainer.innerHTML = `<div class="alert-box" role="alert">${message}</div>`;
    }

    showLoading(isLoading) {
        const alertContainer = document.getElementById('alert-container');
        if (isLoading) {
            alertContainer.innerHTML = `<div class="alert-box" style="background: var(--secondary);" role="status">Loading data...</div>`;
        } else if (alertContainer.innerHTML.includes('Loading data...')) {
            alertContainer.innerHTML = '';
        }
    }

    startDataPolling() {
        this.fetchData().then(data => this.updateDashboard(data));
        setInterval(() => {
            this.fetchData().then(data => this.updateDashboard(data));
        }, this.updateInterval);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GramJYOTIDashboard();
});
