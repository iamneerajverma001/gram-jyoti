// dashboard.js - Complete Offline Dashboard
class GramJYOTIDashboard {
    constructor() {
        this.channelId = '3072359'; // Replace with your ThingSpeak channel ID
        this.readAPIKey = '5U4LUIC6VHGRKS2B'; // Replace with your read API key
        this.updateInterval = 15000; // 30 seconds
        this.charts = {};
        this.historicalData = [];
        this.maxDataPoints = 100;
        
        this.initCharts();
        this.startDataPolling();
        this.loadHistoricalData();
    }

    initCharts() {
        // Initialize ECharts instances
        this.charts.solar = echarts.init(document.getElementById('solar-chart'));
        this.charts.battery = echarts.init(document.getElementById('battery-chart'));
        this.charts.efficiency = echarts.init(document.getElementById('efficiency-chart'));
        this.charts.temperature = echarts.init(document.getElementById('temp-chart'));

        const commonChartOption = {
            grid: { top: 10, right: 10, bottom: 20, left: 40 },
            tooltip: { trigger: 'axis' },
            xAxis: { type: 'time' },
            yAxis: { type: 'value' },
            series: [{ type: 'line', showSymbol: false, smooth: true }]
        };

        this.charts.solar.setOption({
            ...commonChartOption,
            title: { text: 'Power Trend', left: 'center', textStyle: { fontSize: 12 } },
            series: [{ data: [], name: 'Solar Power' }]
        });

        this.charts.battery.setOption({
            ...commonChartOption,
            title: { text: 'SOC Trend', left: 'center', textStyle: { fontSize: 12 } },
            series: [{ data: [], name: 'State of Charge' }]
        });

        this.charts.efficiency.setOption({
            ...commonChartOption,
            title: { text: 'Efficiency', left: 'center', textStyle: { fontSize: 12 } },
            series: [{ data: [], name: 'Efficiency %' }]
        });

        this.charts.temperature.setOption({
            ...commonChartOption,
            title: { text: 'Temperature', left: 'center', textStyle: { fontSize: 12 } },
            series: [{ data: [], name: 'Battery Temp' }]
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            Object.values(this.charts).forEach(chart => chart.resize());
        });
    }

    async fetchData() {
        try {
            const url = `https://api.thingspeak.com/channels/${this.channelId}/feeds.json?api_key=${this.readAPIKey}&results=10`;
            const response = await fetch(url);
            
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            return this.processData(data);
        } catch (error) {
            console.error('Error fetching data:', error);
            this.showError('Failed to fetch data. Using offline cache.');
            return this.getCachedData();
        }
    }

    processData(data) {
        if (!data.feeds || data.feeds.length === 0) {
            throw new Error('No data available');
        }

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

        // Calculate efficiency
        processedData.efficiency = processedData.solar_power > 0 ? 
            (processedData.load_power / processedData.solar_power) * 100 : 0;

        return processedData;
    }

    updateDashboard(data) {
        // Update metrics
        document.getElementById('solar-power').textContent = data.solar_power.toFixed(1);
        document.getElementById('solar-voltage').textContent = data.solar_voltage.toFixed(1);
        document.getElementById('solar-current').textContent = data.solar_current.toFixed(2);
        
        document.getElementById('battery-soc').textContent = data.soc.toFixed(0);
        document.getElementById('battery-voltage').textContent = data.battery_voltage.toFixed(1);
        document.getElementById('battery-current').textContent = data.battery_current.toFixed(2);
        document.getElementById('battery-temp').textContent = data.battery_temp.toFixed(1);
        
        document.getElementById('system-efficiency').textContent = data.efficiency.toFixed(1);
        document.getElementById('light-intensity').textContent = data.ambient_light.toFixed(0);
        
        document.getElementById('last-update').textContent = data.timestamp.toLocaleTimeString();

        // Update charts
        this.updateCharts(data);

        // Check for alerts
        this.checkAlerts(data);

        // Store data
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
        if (seriesData.length > this.maxDataPoints) {
            seriesData.shift();
        }
        
        option.series[0].data = seriesData;
        chart.setOption(option);
    }

    checkAlerts(data) {
        const alertContainer = document.getElementById('alert-container');
        alertContainer.innerHTML = '';

        const alerts = [];

        if (data.battery_temp > 45) {
            alerts.push('⚠️ CRITICAL: Battery temperature too high (>45°C)');
        }

        if (data.battery_voltage > 14.5) {
            alerts.push('⚠️ WARNING: Overvoltage detected (>14.5V)');
        }

        if (data.battery_voltage < 11.5) {
            alerts.push('⚠️ WARNING: Undervoltage detected (<11.5V)');
        }

        if (data.soc < 20) {
            alerts.push('⚠️ WARNING: Low battery (<20%)');
        }

        if (alerts.length > 0) {
            const alertHtml = alerts.map(alert => 
                `<div class="alert-box">${alert}</div>`
            ).join('');
            alertContainer.innerHTML = alertHtml;
            
            // Update status badge
            document.getElementById('system-status').className = 'status-badge status-danger';
            document.getElementById('system-status').textContent = 'ALERT';
            
            // Trigger notification sound
            this.playAlertSound();
        } else {
            document.getElementById('system-status').className = 'status-badge status-normal';
            document.getElementById('system-status').textContent = 'NORMAL';
        }
    }

    playAlertSound() {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDci0FLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGnN/0xIIwChhVrefusF0WED2Q2fTDfzMMHEyo5O2zYxwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bNlHA1Al93zw30xCyBSrOjts2UcDUCX3fPDfTELIFKs6O2zZRwNQJfd88N9MQsgUqzo7bN2zA=');
        audio.play().catch(e => console.log('Audio play failed:', e));
    }

    storeData(data) {
        this.historicalData.push(data);
        if (this.historicalData.length > 100) {
            this.historicalData.shift();
        }
        localStorage.setItem('gramjyoti_data', JSON.stringify(this.historicalData));
    }

    loadHistoricalData() {
        try {
            const stored = localStorage.getItem('gramjyoti_data');
            if (stored) {
                this.historicalData = JSON.parse(stored);
                // Populate charts with historical data
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
            efficiency: 0
        };
    }

    showError(message) {
        const alertContainer = document.getElementById('alert-container');
        alertContainer.innerHTML = `<div class="alert-box">${message}</div>`;
    }

    startDataPolling() {
        // Initial fetch
        this.fetchData().then(data => this.updateDashboard(data));
        
        // Periodic updates
        setInterval(() => {
            this.fetchData().then(data => this.updateDashboard(data));
        }, this.updateInterval);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new GramJYOTIDashboard();

});
