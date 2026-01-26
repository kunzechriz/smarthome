import plotly.graph_objects as go
import yfinance as yf
import pandas as pd
from flask import Blueprint, Response

btc_backend_blueprint = Blueprint('btc', __name__)

# ----------------------------------------------------------------------------------------------------------#

@btc_backend_blueprint.route('/api/btc/get_chart/<interval>')
def update_chart(interval):
    json_data = create_bitcoin_data(interval)
    return Response(json_data, mimetype='application/json')
# ----------------------------------------------------------------------------------------------------------#


def create_bitcoin_data(interval='1h'):
    # Zeiträume
    if interval == '1wk':
        period = '2y'
    elif interval == '1d':
        period = '1y'
    else:
        period = '5d'

    try:
        # 1. Daten laden
        ticker = yf.Ticker("BTC-USD")
        df = ticker.history(period=period, interval=interval)

        if df.empty:
            print(f"BTC Backend: Keine Daten geladen für {interval}")
            return "{}"

        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(-1)

        df.index = df.index.tz_localize(None)

        if interval == '1h':
            date_strings = df.index.strftime('%Y-%m-%d %H:%M').tolist()
        else:
            date_strings = df.index.strftime('%Y-%m-%d').tolist()

        # 4. Daten explizit in Listen umwandeln
        open_data = df['Open'].tolist()
        high_data = df['High'].tolist()
        low_data = df['Low'].tolist()
        close_data = df['Close'].tolist()

        # 5. Chart bauen
        fig = go.Figure(data=[go.Candlestick(
            x=date_strings,
            open=open_data,
            high=high_data,
            low=low_data,
            close=close_data,
            name='Bitcoin'
        )])

        # 6. Design
        fig.update_layout(
            title=dict(text=f'Bitcoin ({interval})', x=0.5),
            template='plotly_dark',
            paper_bgcolor='rgba(0,0,0,0)',
            plot_bgcolor='rgba(0,0,0,0)',
            font=dict(color='white'),
            margin=dict(l=10, r=10, t=40, b=10),
            xaxis_rangeslider_visible=False,
            height=350,
            autosize=True
        )

        return fig.to_json()

    except Exception as e:
        print(f"KRITISCHER FEHLER im BTC Backend: {e}")
        import traceback
        traceback.print_exc()
        return "{}"
    # ----------------------------------------------------------------------------------------------------------#
